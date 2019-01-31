# hgbasm CLI
A command-line interface for the hgbasm Game Boy assembly compiler.

Note that this project is not a perfect port of the RGBDS suite and is not guaranteed to accept every valid assembly file or generate binary-compatible output. However, issues related to compatibility will be addressed as they are reported, especially if there is no suitably trivial workaround available. Pull requests welcome.

## Installation
`npm install -g hgbasm-cli`

## Usage
The following command-line utilities will be available after installation:
- `hgbasm`: a drop-in replacement for `rgbasm`.
- `hgblink`: a drop-in replacement for `rgblink`.
- `hgbfix`: a drop-in replacement for `rgbfix`.

## Contribution
All feature requests, issues, and code contributions are welcome. Just clone the repo, make any changes to the TypeScript code, and submit a pull request.

## Credits
Thanks to the various contributors to the RGBDS suite; Donald Hays, creator of the existing RGBDS GBZ80 VSCode plugin; Beware, creator of the emulator BGB; and special thanks to the members of the gbdev Discord server, particularly ISSOtm and PinoBatch, for helping teach GameBoy development.

## License
MIT