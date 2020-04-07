export {};

const timeout = setTimeout(() => {}, 0);

if (timeout.unref) {
  timeout.unref();
}
