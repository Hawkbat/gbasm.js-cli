#!/usr/bin/env node
import * as program from 'commander'
import * as fs from 'fs-extra'
import * as gbasm from 'hgbasm'
import * as pathUtil from 'path'

const rootFolder: string = process.cwd()
let objectPaths: string[] = []

program
    // tslint:disable-next-line: no-var-requires
    .version(require('./package.json').version)
    .arguments('<objectfiles...>')
    .action((objectfiles) => {
        objectPaths = objectfiles
    })
    .option('-m, --map <mapfile>', 'Write a mapfile to the given filename.')
    .option('-n, --sym <symfile>', 'Write a symbol file to the given filename.')
    .option('-O, --overlay <overlayfile>', 'The ROM image to overlay sections over. When an overlay ROM is provided, all sections must be fixed. This may be used to patch an existing binary.')
    .option('-o, --out <outfile>', 'Write ROM image to the given filename.')
    .option('-p, --pad <pad_value>', 'When padding an image, pad with this value. The default is 0x00.')
    .option('-w, --no-wram-bank', 'Expand the WRAM0 section size from 4KiB to the full 8KiB assigned to WRAM and prohibit the use of WRAMX sections.')
    .option('-d, --dmg', 'Enable DMG mode. Prohibit the use of sections that doesn\'t exist on a DMG, such as WRAMX and VRAM bank 1. This option automatically enables -w.')
    .option('-t, --no-rom-bank', 'Expand the ROM0 section size from 16KiB to the full 32KiB assigned to ROM and prohibit the use of ROMX sections. Useful for ROMs that fit in 32 KiB.')
    .option('-l, --linkerscript <linkerscript>', 'Specify a linkerscript file that tells the linker how sections must be placed in the ROM. This file has priority over the attributes assigned in the source code, but they have to be consistent. See rgblink(5) for more information about its format.')
    .parse(process.argv)

if (!objectPaths.length) {
    console.error('No object files specified, exiting')
    process.exit(1)
}

async function run(): Promise<void> {
    const logger = new gbasm.Logger('info')
    try {
        const objectFiles = objectPaths.map((path) => gbasm.readObjectFile(pathUtil.relative(rootFolder, path), fs.readFileSync(path)))

        logger.log('compileInfo', `Linking ${objectFiles.map((obj) => obj.path).join(', ')}`)

        const link = new gbasm.Linker(logger)
        const result = await link.link(new gbasm.LinkerContext({
            disableRomBanks: program.romBank !== undefined ? !program.romBank : false,
            disableVramBanks: program.dmg !== undefined ? program.dmg : false,
            disableWramBanks: program.dmg !== undefined ? program.dmg : program.wramBank !== undefined ? !program.wramBank : false,
            linkerScript: program.linkerscript ? fs.readFileSync(program.linkerscript, 'utf8') : '',
            generateSymbolFile: program.sym ? true : false,
            generateMapFile: program.map ? true : false,
            padding: program.pad !== undefined ? parseInt(program.pad) : 0x00,
            overlay: program.overlay ? fs.readFileSync(program.overlay) : null
        }, objectFiles))

        if (result.symbolFile) {
            fs.writeFileSync(program.sym, result.symbolFile)
        }

        if (result.mapFile) {
            fs.writeFileSync(program.map, result.mapFile)
        }

        if (result.romFile) {
            fs.writeFileSync(program.out, result.romFile)
        }

        const errorCount = result.diagnostics.filter((diag) => diag.type === 'error').length
        const warnCount = result.diagnostics.filter((diag) => diag.type === 'warn').length

        logger.log('compileInfo', `Linking ${errorCount ? 'failed' : 'finished'} with ${errorCount} ${errorCount === 1 ? 'error' : 'errors'} and ${warnCount} ${warnCount === 1 ? 'warning' : 'warnings'}`)
    } catch (err) {
        logger.log('compileCrash', `A fatal error occurred during linking.\n${err.stack}`)
    }
}

run()
