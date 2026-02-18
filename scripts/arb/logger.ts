const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bold: "\x1b[1m",
};

function timestamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
}

function prefix(label: string, color: string): string {
  return `${COLORS.gray}${timestamp()}${COLORS.reset} ${color}${label}${COLORS.reset}`;
}

export const log = {
  info(msg: string) {
    console.log(`${prefix("[INFO]", COLORS.cyan)} ${msg}`);
  },

  success(msg: string) {
    console.log(`${prefix("[OK]", COLORS.green)} ${COLORS.green}${msg}${COLORS.reset}`);
  },

  warn(msg: string) {
    console.log(`${prefix("[WARN]", COLORS.yellow)} ${COLORS.yellow}${msg}${COLORS.reset}`);
  },

  error(msg: string) {
    console.error(`${prefix("[ERR]", COLORS.red)} ${COLORS.red}${msg}${COLORS.reset}`);
  },

  trade(msg: string) {
    console.log(`${prefix("[TRADE]", COLORS.magenta)} ${COLORS.bold}${msg}${COLORS.reset}`);
  },

  opportunity(msg: string) {
    console.log(`${prefix("[ARB]", COLORS.bgGreen + COLORS.white)} ${COLORS.bold}${msg}${COLORS.reset}`);
  },

  verbose(msg: string, enabled: boolean) {
    if (enabled) {
      console.log(`${prefix("[DBG]", COLORS.gray)} ${COLORS.gray}${msg}${COLORS.reset}`);
    }
  },

  banner(msg: string) {
    const line = "═".repeat(60);
    console.log(`\n${COLORS.cyan}${line}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.cyan}  ${msg}${COLORS.reset}`);
    console.log(`${COLORS.cyan}${line}${COLORS.reset}\n`);
  },

  separator() {
    console.log(`${COLORS.gray}${"─".repeat(60)}${COLORS.reset}`);
  },
};
