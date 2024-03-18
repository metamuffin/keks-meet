use crate::{command::dispatch_command, Command, State};
use clap::Parser;
use libkeks::instance::Instance;
use log::{error, info, warn};
use rustyline::{
    completion::{Candidate, Completer},
    config::Configurer,
    error::ReadlineError,
    highlight::Highlighter,
    hint::{Hint, Hinter},
    validate::{ValidationResult, Validator},
    Editor, Helper,
};
use std::{borrow::Cow, sync::Arc};
use tokio::sync::RwLock;

pub(crate) async fn repl(inst: Arc<Instance>, state: Arc<RwLock<State>>) -> anyhow::Result<()> {
    let mut rl = Editor::new()?;
    rl.set_auto_add_history(true);
    rl.set_helper(Some(ReplHelper {}));
    loop {
        match rl.readline("> ") {
            Ok(line) => match shlex::split(&line) {
                Some(tokens) => match Command::try_parse_from(tokens) {
                    Ok(command) => match dispatch_command(&inst, &state, command).await {
                        Ok(()) => (),
                        Err(err) => error!(target: "rift", "{err}"),
                    },
                    Err(err) => err.print().unwrap(),
                },
                None => warn!("fix your quoting"),
            },
            Err(ReadlineError::Eof) => {
                info!("exit");
                break;
            }
            Err(ReadlineError::Interrupted) => {
                info!("interrupted; exiting...");
                break;
            }
            Err(e) => Err(e)?,
        }
    }
    Ok(())
}

struct ReplHelper {}

impl Helper for ReplHelper {}

impl Validator for ReplHelper {
    fn validate(
        &self,
        ctx: &mut rustyline::validate::ValidationContext,
    ) -> rustyline::Result<rustyline::validate::ValidationResult> {
        let _ = ctx;
        match shlex::split(ctx.input()) {
            Some(_tokens) => Ok(ValidationResult::Valid(None)),
            None => Ok(ValidationResult::Invalid(Some(
                " incorrect quoting".to_string(),
            ))),
        }
    }
    fn validate_while_typing(&self) -> bool {
        true
    }
}

impl Hinter for ReplHelper {
    type Hint = ReplHint;
    fn hint(&self, line: &str, pos: usize, ctx: &rustyline::Context<'_>) -> Option<Self::Hint> {
        let _ = (line, pos, ctx);
        None
    }
}

struct ReplHint;
impl Hint for ReplHint {
    fn display(&self) -> &str {
        ""
    }
    fn completion(&self) -> Option<&str> {
        None
    }
}

impl Completer for ReplHelper {
    type Candidate = ReplCandidate;
    fn complete(
        &self,
        line: &str,
        pos: usize,
        ctx: &rustyline::Context<'_>,
    ) -> rustyline::Result<(usize, Vec<Self::Candidate>)> {
        let _ = (line, pos, ctx);
        Ok((0, Vec::with_capacity(0)))
    }

    fn update(
        &self,
        line: &mut rustyline::line_buffer::LineBuffer,
        start: usize,
        elected: &str,
        cl: &mut rustyline::Changeset,
    ) {
        let end = line.pos();
        line.replace(start..end, elected, cl);
    }
}

struct ReplCandidate {}
impl Candidate for ReplCandidate {
    fn display(&self) -> &str {
        ""
    }

    fn replacement(&self) -> &str {
        ""
    }
}

impl Highlighter for ReplHelper {
    fn highlight_prompt<'b, 's: 'b, 'p: 'b>(
        &'s self,
        prompt: &'p str,
        _default: bool,
    ) -> Cow<'b, str> {
        Cow::Borrowed(prompt)
    }
    fn highlight_hint<'h>(&self, hint: &'h str) -> Cow<'h, str> {
        Cow::Owned("\x1b[1m".to_owned() + hint + "\x1b[m")
    }
    fn highlight<'l>(&self, line: &'l str, _pos: usize) -> Cow<'l, str> {
        Cow::Borrowed(line)
    }
    fn highlight_char(&self, _line: &str, _pos: usize, _forced: bool) -> bool {
        false
    }
}
