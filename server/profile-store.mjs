// Keep the last valid disk profile. A broken primary must never replace its backup.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validProfile } from "../public/core/profile-schema.js";

export class ProfileStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, "profile.json");
    this.recovered = false;
  }
  safeDirectory(create = false) {
    if (create) fs.mkdirSync(this.directory, {recursive: true});
    try {
      const stat = fs.lstatSync(this.directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error("unsafe-profile-directory");
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  readFile(file) {
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 ** 2)
        throw Error("invalid-profile-file");
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!validProfile(data)) throw Error("invalid-profile");
      return data;
    } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }
  read() {
    this.safeDirectory();
    this.recovered = false;
    let primary, failure;
    try { primary = this.readFile(this.file); } catch (error) { failure = error; }
    if (primary) return primary;
    const backup = this.readFile(this.file + ".bak");
    if (backup) { this.recovered = true; return backup; }
    if (failure) throw failure;
    return null;
  }
  write(value) {
    if (!validProfile(value)) throw Error("invalid-profile");
    const body = JSON.stringify(value, null, 2);
    if (Buffer.byteLength(body) > 8 * 1024 ** 2) throw Error("profile-too-large");
    this.safeDirectory(true);
    const previous = this.read(); // Refuse to erase an unrecoverable profile.
    const temp = this.file + "." + crypto.randomBytes(8).toString("hex") + ".tmp";
    const backupTemp = temp + ".bak";
    try {
      fs.writeFileSync(temp, body, {flag:"wx"});
      if (previous) {
        const backup = this.file + ".bak";
        try { if (fs.lstatSync(backup).isSymbolicLink()) throw Error("unsafe-profile-backup"); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        fs.writeFileSync(backupTemp, JSON.stringify(previous), {flag:"wx"});
        fs.renameSync(backupTemp, backup);
      }
      // Never follow a file symlink when replacing a profile recovered from backup.
      try { if (fs.lstatSync(this.file).isSymbolicLink()) throw Error("unsafe-profile-file"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      fs.renameSync(temp, this.file);
    } finally {
      for (const file of [temp, backupTemp]) try { fs.unlinkSync(file); } catch {}
    }
  }
}
