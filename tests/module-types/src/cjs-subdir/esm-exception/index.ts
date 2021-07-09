export const cjs: boolean = true;

declare const require: any;
const requireType = typeof require;

export default { requireType };
