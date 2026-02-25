declare module "fs" {
  export const readFileSync: any;
  export const writeFileSync: any;
  export const existsSync: any;
  export const copyFileSync: any;
  export const renameSync: any;
  export const mkdirSync: any;
}

declare module "os" {
  export const homedir: any;
}

declare module "path" {
  export const dirname: any;
  export const join: any;
}

declare module "readline" {
  const readline: any;
  export = readline;
}

declare const process: any;
