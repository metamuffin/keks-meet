



const decoder = new TextDecoder();
let text = ""
for await (const chunk of Deno.stdin.readable) {
    text += decoder.decode(chunk);
}

for (const ob of text.split("\n")) {
    if (!ob.length) continue
    console.log(JSON.stringify(JSON.parse(ob), null, 4));
}


