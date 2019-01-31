#!/usr/bin/env node
import * as program from 'commander'
import * as fs from 'fs-extra'
import * as gbasm from 'hgbasm'

let romPath = ''

program
    // tslint:disable-next-line: no-var-requires
    .version(require('./package.json').version)
    .arguments('<romfile>')
    .action((romfile) => {
        romPath = romfile
    })
    .option('-C, --cgb-only', 'Set the Game Boy Color–only flag: 0x143 = 0xC0. If both this and the -c flag are set, this takes precedence.')
    .option('-c, --cgb-compatible', 'Set the Game Boy Color–compatible flag: 0x143 = 0x80. If both this and the -C flag are set, -C takes precedence.')
    .option('-f, --fix <fix_spec>', `Fix certain header values that the Game Boy checks for correctness. Alternatively, intentionally trash these values by writing their binary inverse instead. fix_spec is a string containing any combination of the following characters:
l Fix the Nintendo logo (0x104–0x133).
L Trash the Nintendo logo.
h Fix the header checksum (0x14D).
H Trash the header checksum.
g Fix the global checksum (0x14E–0x14F).
G Trash the global checksum.`)
    .option('-i, --id <game_id>', 'Set the game ID string (0x13F–0x142) to a given string of exactly 4 characters. If both this and the title are set, the game ID will overwrite the overlapping portion of the title.')
    .option('-j, --non-japanese', 'Set the non-Japanese region flag: 0x14A = 1.')
    .option('-k, --new-licensee <str>', 'Set the new licensee string (0x144–0x145) to a given string, truncated to at most two characters.')
    .option('-l, --old-licensee <id>', 'Set the old licensee code, 0x14B, to a given value from 0 to 0xFF. This value is deprecated and should be set to 0x33 in all new software.')
    .option('-m, --mbc', 'Set the MBC type, 0x147, to a given value from 0 to 0xFF.')
    .option('-n, --rom-version', 'Set the ROM version, 0x14C, to a given value from 0 to 0xFF.')
    .option('-p, --pad <pad_value>', 'Pad the image to a valid size with a given pad value from 0 to 0xFF. gbfix will automatically pick a size from 32KiB, 64KiB, 128KiB, ..., 8192KiB. The cartridge size byte (0x148) will be changed to reflect this new size.')
    .option('-r, --ram', 'Set the RAM size, 0x149, to a given value from 0 to 0xFF.')
    .option('-s, --sgb', 'Set the SGB flag: 0x146 = 3.')
    .option('-t, --title <title>', 'Set the title string (0x134–0x143) to a given string, truncated to at most 16 characters. It is recommended to use 15 characters instead, to avoid clashing with the CGB flag (-c or -C). If both this and the game ID are set, the game ID will overwrite the overlapping portion of the title.')
    .option('-v, --fix-all', 'Equivalent to -f lhg.')
    .parse(process.argv)

if (!romPath) {
    console.error('No ROM file specified, exiting')
    process.exit(1)
}

async function run(): Promise<void> {
    const logger = new gbasm.Logger('info')
    try {
        logger.log('compileInfo', `Fixing ${romPath}`)

        const romFile = fs.readFileSync(romPath)

        const fixer = new gbasm.Fixer(logger)
        const result = await fixer.fix(new gbasm.FixerContext({
            cgbCompatibility: program.cgbOnly ? 'cgb' : program.cgbCompatible ? 'both' : undefined,
            sgbCompatible: program.sgb,
            nintendoLogo: program.fixAll || program.fix.includes('l') ? 'fix' : program.fix.includes('L') ? 'trash' : undefined,
            headerChecksum: program.fixAll || program.fix.includes('h') ? 'fix' : program.fix.includes('H') ? 'trash' : undefined,
            globalChecksum: program.fixAll || program.fix.includes('g') ? 'fix' : program.fix.includes('G') ? 'trash' : undefined,
            japanese: program.nonJapanese ? !program.nonJapanese : undefined,
            licensee: program.newLicensee,
            licenseeCode: program.oldLicensee,
            mbcType: program.mbc,
            ramSize: program.ram,
            gameId: program.id,
            gameTitle: program.title,
            gameVersion: program.romVersion,
            padding: program.pad
        }, romFile))

        if (result.romFile) {
            fs.writeFileSync(romPath, result.romFile)
        }

        logger.log('compileInfo', `Fixing of ${romPath} finished`)
    } catch (err) {
        logger.log('compileCrash', `A fatal error occurred during fixing.\n${err.stack}`)
    }
}

run()
