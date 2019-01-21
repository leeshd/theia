#!/usr/bin/env node
/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
// @ts-check

const fs = require('fs');
const url = require('url');
const request = require('request');
const unzip = require('unzip-stream');
const path = require('path');
const process = require('process');
const zlib = require('zlib');
const mkdirp = require('mkdirp');
const tar = require('tar');

const pck = require(path.resolve(process.cwd(), 'package.json'));

for (const name in pck.adapters) {
    const locationUrl = url.parse(pck.adapters[name]);
    let archiveStream;
    if (!locationUrl.protocol || locationUrl.protocol === 'file:') {
        const locationPath = path.isAbsolute(locationUrl.path) ? locationUrl.path : path.join(process.cwd(), locationUrl.path);
        archiveStream = fs.createReadStream(locationPath)
    } else {
        archiveStream = request({
            ...pck.requestOptions,
            url: pck.adapters[name]
        });
    }

    const targetPath = path.join(process.cwd(), pck.adapterDir || 'download', name);
    if (pck.adapters[name].endsWith('gz')) {
        // Support tar gz
        mkdirp(targetPath);
        const gunzip = zlib.createGunzip({
            finishFlush: zlib.Z_SYNC_FLUSH,
            flush: zlib.Z_SYNC_FLUSH
        });
        const untar = tar.x({
            cwd: targetPath
        });
        archiveStream.pipe(gunzip).pipe(untar);
    } else {
        // @ts-ignore Support zip or vsix
        archiveStream.pipe(unzip.Extract({ path: targetPath }));
    }
}
