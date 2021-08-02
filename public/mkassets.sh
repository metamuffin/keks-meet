#!/bin/sh
pushd .
cd $(dirname $0)
convert -size 256x256 -define gradient:radii=64,64 radial-gradient:white-black assets/light.png
convert -size 256x256 xc:white -fill black -stroke black -draw "rectangle 64,64 192,192" -rotate 45 -blur 40x40 assets/void.png

popd