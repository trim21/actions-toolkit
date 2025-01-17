/**
 * Copyright 2024 actions-toolkit authors
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
import * as httpm from '@actions/http-client';
import * as tc from '@actions/tool-cache';
import * as semver from 'semver';
import * as util from 'util';

import {Cache} from '../cache';
import {Context} from '../context';

import {GitHubRelease} from '../types/github';
import {DownloadVersion} from '../types/undock/undock';

export class Install {
  /*
   * Download undock binary from GitHub release
   * @param v: version semver version or latest
   * @param ghaNoCache: disable binary caching in GitHub Actions cache backend
   * @returns path to the undock binary
   */
  public async download(v: string, ghaNoCache?: boolean): Promise<string> {
    const version: DownloadVersion = await Install.getDownloadVersion(v);
    core.debug(`Install.download version: ${version.version}`);

    const release: GitHubRelease = await Install.getRelease(version);
    core.debug(`Install.download release tag name: ${release.tag_name}`);

    const vspec = await this.vspec(release.tag_name);
    core.debug(`Install.download vspec: ${vspec}`);

    const c = semver.clean(vspec) || '';
    if (!semver.valid(c)) {
      throw new Error(`Invalid Undock version "${vspec}".`);
    }

    const installCache = new Cache({
      htcName: 'undock-dl-bin',
      htcVersion: vspec,
      baseCacheDir: path.join(os.homedir(), '.bin'),
      cacheFile: os.platform() == 'win32' ? 'undock.exe' : 'undock',
      ghaNoCache: ghaNoCache
    });

    const cacheFoundPath = await installCache.find();
    if (cacheFoundPath) {
      core.info(`Unodck binary found in ${cacheFoundPath}`);
      return cacheFoundPath;
    }

    const downloadURL = util.format(version.downloadURL, vspec, this.filename(vspec));
    core.info(`Downloading ${downloadURL}`);

    const htcDownloadPath = await tc.downloadTool(downloadURL);
    core.debug(`Install.download htcDownloadPath: ${htcDownloadPath}`);

    let htcExtPath: string;
    if (os.platform() == 'win32') {
      htcExtPath = await tc.extractZip(htcDownloadPath);
    } else {
      htcExtPath = await tc.extractTar(htcDownloadPath);
    }
    core.info(`Extracted to ${htcExtPath}`);

    const exePath: string = path.join(htcExtPath, os.platform() == 'win32' ? 'undock.exe' : 'undock');
    core.debug(`Install.download exePath: ${exePath}`);

    const cacheSavePath = await installCache.save(exePath);
    core.info(`Cached to ${cacheSavePath}`);
    return cacheSavePath;
  }

  public async install(binPath: string, dest?: string): Promise<string> {
    dest = dest || Context.tmpDir();

    const binDir = path.join(dest, 'undock-bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, {recursive: true});
    }
    const binName: string = os.platform() == 'win32' ? 'undock.exe' : 'undock';
    const undockPath: string = path.join(binDir, binName);
    fs.copyFileSync(binPath, undockPath);

    core.info('Fixing perms');
    fs.chmodSync(undockPath, '0755');

    core.addPath(binDir);
    core.info('Added Unodck to PATH');

    core.info(`Binary path: ${undockPath}`);
    return undockPath;
  }

  private filename(version: string): string {
    let arch: string;
    switch (os.arch()) {
      case 'x64': {
        arch = 'amd64';
        break;
      }
      case 'ppc64': {
        arch = 'ppc64le';
        break;
      }
      case 'arm': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arm_version = (process.config.variables as any).arm_version;
        arch = arm_version ? 'armv' + arm_version : 'arm';
        break;
      }
      default: {
        arch = os.arch();
        break;
      }
    }
    const platform: string = os.platform() == 'win32' ? 'windows' : os.platform();
    const ext: string = os.platform() == 'win32' ? '.zip' : '.tar.gz';
    return util.format('undock_%s_%s_%s%s', version, platform, arch, ext);
  }

  private async vspec(version: string): Promise<string> {
    const v = version.replace(/^v+|v+$/g, '');
    core.info(`Use ${v} version spec cache key for ${version}`);
    return v;
  }

  public static async getDownloadVersion(v: string): Promise<DownloadVersion> {
    return {
      version: v,
      downloadURL: 'https://github.com/crazy-max/undock/releases/download/v%s/%s',
      releasesURL: 'https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/undock-releases.json'
    };
  }

  public static async getRelease(version: DownloadVersion): Promise<GitHubRelease> {
    const http: httpm.HttpClient = new httpm.HttpClient('docker-actions-toolkit');
    const resp: httpm.HttpClientResponse = await http.get(version.releasesURL);
    const body = await resp.readBody();
    const statusCode = resp.message.statusCode || 500;
    if (statusCode >= 400) {
      throw new Error(`Failed to get Undock releases from ${version.releasesURL} with status code ${statusCode}: ${body}`);
    }
    const releases = <Record<string, GitHubRelease>>JSON.parse(body);
    if (!releases[version.version]) {
      throw new Error(`Cannot find Undock release ${version.version} in ${version.releasesURL}`);
    }
    return releases[version.version];
  }
}
