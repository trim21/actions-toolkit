/**
 * Copyright 2023 actions-toolkit authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as cache from '@actions/cache';
import * as util from 'util';

export interface CacheOpts {
  htcName: string;
  htcVersion: string;
  baseCacheDir: string;
  cacheFile: string;
}

export class Cache {
  private readonly opts: CacheOpts;
  private readonly ghaCacheKey: string;
  private readonly cacheDir: string;
  private readonly cachePath: string;

  constructor(opts: CacheOpts) {
    this.opts = opts;
    this.ghaCacheKey = util.format('%s-%s-%s', this.opts.htcName, this.opts.htcVersion, this.platform());
    this.cacheDir = path.join(this.opts.baseCacheDir, this.opts.htcVersion, this.platform());
    this.cachePath = path.join(this.cacheDir, this.opts.cacheFile);
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, {recursive: true});
    }
  }

  public async save(file: string): Promise<string> {
    core.debug(`Cache.save ${file}`);
    const cachePath = this.copyToCache(file);

    const htcPath = await tc.cacheDir(this.cacheDir, this.opts.htcName, this.opts.htcVersion, this.platform());
    core.debug(`Cache.save cached to hosted tool cache ${htcPath}`);

    if (cache.isFeatureAvailable()) {
      core.debug(`Cache.save caching ${this.ghaCacheKey} to GitHub Actions cache`);
      await cache.saveCache([this.cacheDir], this.ghaCacheKey);
    }

    return cachePath;
  }

  public async find(): Promise<string> {
    let htcPath = tc.find(this.opts.htcName, this.opts.htcVersion, this.platform());
    if (htcPath) {
      core.info(`Restored from hosted tool cache ${htcPath}`);
      return this.copyToCache(`${htcPath}/${this.opts.cacheFile}`);
    }

    if (cache.isFeatureAvailable()) {
      core.debug(`GitHub Actions cache feature available`);
      if (await cache.restoreCache([this.cacheDir], this.ghaCacheKey)) {
        core.info(`Restored ${this.ghaCacheKey} from GitHub Actions cache`);
        htcPath = await tc.cacheDir(this.cacheDir, this.opts.htcName, this.opts.htcVersion, this.platform());
        core.info(`Restored to hosted tool cache ${htcPath}`);
        return this.copyToCache(`${htcPath}/${this.opts.cacheFile}`);
      }
    } else {
      core.info(`GitHub Actions cache feature not available`);
    }

    return '';
  }

  private copyToCache(file: string): string {
    core.debug(`Copying ${file} to ${this.cachePath}`);
    fs.copyFileSync(file, this.cachePath);
    return this.cachePath;
  }

  private platform(): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arm_version = (process.config.variables as any).arm_version;
    return `${os.platform()}-${os.arch()}${arm_version ? 'v' + arm_version : ''}`;
  }
}