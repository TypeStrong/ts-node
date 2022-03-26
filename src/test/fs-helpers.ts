import { TEST_DIR } from './helpers';
import * as fs from 'fs';
import * as Path from 'path';

// Helpers to describe a bunch of files in a project programmatically,
// then write them to disk in a temp directory.

export interface File {
  path: string;
  content: string;
}
export interface JsonFile<T> extends File {
  obj: T;
}
export interface DirectoryApi {
  add(file: File): File;
  addFile(...args: Parameters<typeof file>): File;
  addJsonFile(...args: Parameters<typeof jsonFile>): JsonFile<any>;
  dir(dirPath: string, cb?: (dir: DirectoryApi) => void): DirectoryApi;
}

export type ProjectAPI = ReturnType<typeof projectInternal>;

export function file(path: string, content = '') {
  return { path, content };
}
export function jsonFile<T>(path: string, obj: T) {
  const file: JsonFile<T> = {
    path,
    obj,
    get content() {
      return JSON.stringify(obj, null, 2);
    },
  };
  return file;
}

export function tempdirProject(name = '') {
  const rootTmpDir = `${TEST_DIR}/tmp/`;
  fs.mkdirSync(rootTmpDir, { recursive: true });
  const tmpdir = fs.mkdtempSync(`${TEST_DIR}/tmp/${name}`);
  return projectInternal(tmpdir);
}

export function project(name: string) {
  return projectInternal(`${TEST_DIR}/tmp/${name}`);
}

function projectInternal(cwd: string) {
  const files: File[] = [];
  function write() {
    for (const file of files) {
      fs.mkdirSync(Path.dirname(file.path), { recursive: true });
      fs.writeFileSync(file.path, file.content);
    }
  }
  function rm() {
    fs.rmdirSync(cwd, { recursive: true });
  }
  const { add, addFile, addJsonFile, dir } = createDirectory(cwd);
  function createDirectory(
    dirPath: string,
    cb?: (dir: DirectoryApi) => void
  ): DirectoryApi {
    function add(file: File) {
      file.path = Path.join(dirPath, file.path);
      files.push(file);
      return file;
    }
    function addFile(...args: Parameters<typeof file>) {
      return add(file(...args));
    }
    function addJsonFile(...args: Parameters<typeof jsonFile>) {
      return add(jsonFile(...args)) as JsonFile<unknown>;
    }
    function dir(path: string, cb?: (dir: DirectoryApi) => void) {
      return createDirectory(Path.join(dirPath, path), cb);
    }
    const _dir: DirectoryApi = {
      add,
      addFile,
      addJsonFile,
      dir,
    };
    cb?.(_dir);
    return _dir;
  }
  return {
    cwd,
    files: [],
    dir,
    add,
    addFile,
    addJsonFile,
    write,
    rm,
  };
}
