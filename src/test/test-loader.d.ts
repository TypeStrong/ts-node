export {};
declare global {
  namespace NodeJS {
    interface Process {
      __test_setloader__(hooks: any): void;
    }
  }
}
