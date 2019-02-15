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

import { inject, injectable, named } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { net } from '@theia/core/lib/common/net';
import { Endpoint } from '@theia/core/lib/browser';
import { MaybePromise, Prioritizeable } from '@theia/core/lib/common/types';
import { ContributionProvider } from '@theia/core/lib/common/contribution-provider';

/**
 * Contribution for the `LocationMapperService`.
 */
export const LocationMapper = Symbol('LocationMapper');
export interface LocationMapper {

    /**
     * Should return with a positive number if the current contribution can handle the given location.
     * The number indicates the priority of the location mapper. If it is not a positive number, it means, the
     * contribution cannot handle the location.
     */
    canHandle(location: string): MaybePromise<number>;

    /**
     * Maps the given location.
     */
    map(location: string): MaybePromise<string>;

}

/**
 * Location mapper service.
 */
@injectable()
export class LocationMapperService {

    @inject(ContributionProvider)
    @named(LocationMapper)
    protected readonly contributions: ContributionProvider<LocationMapper>;

    async map(location: string): Promise<string> {
        const contributions = await this.prioritize(location);
        if (contributions.length === 0) {
            return this.defaultMapper()(location);
        }
        return contributions[0].map(location);
    }

    protected defaultMapper(): (location: string) => MaybePromise<string> {
        return location => `${new Endpoint().httpScheme}//${location}`;
    }

    protected async prioritize(location: string): Promise<LocationMapper[]> {
        const prioritized = await Prioritizeable.prioritizeAll(this.getContributions(), contribution => contribution.canHandle(location));
        return prioritized.map(p => p.value);
    }

    protected getContributions(): LocationMapper[] {
        return this.contributions.getContributions();
    }

}

/**
 * HTTP location mapper.
 */
@injectable()
export class HttpLocationMapper implements LocationMapper {

    canHandle(location: string): MaybePromise<number> {
        return location.startsWith('http://') ? 1 : 0;
    }

    map(location: string): MaybePromise<string> {
        return location;
    }

}

/**
 * HTTPS location mapper.
 */
@injectable()
export class HttpsLocationMapper implements LocationMapper {

    canHandle(location: string): MaybePromise<number> {
        return location.startsWith('https://') ? 1 : 0;
    }

    map(location: string): MaybePromise<string> {
        return location;
    }

}

/**
 * Location mapper for IP version *4* and version *6* addresses.
 */
@injectable()
export class IPAddressLocationMapper implements LocationMapper {

    canHandle(location: string): MaybePromise<number> {
        const ip = net.isIP(location);
        return (ip === 4 || ip === 6) ? 1 : 0;
    }

    map(location: string): MaybePromise<string> {
        return `http://${location}`;
    }

}

/**
 * Location mapper for the `localhost`.
 */
@injectable()
export class LocalhostLocationMapper implements LocationMapper {

    canHandle(location: string): MaybePromise<number> {
        return location.startsWith('localhost') ? 1 : 0;
    }

    map(location: string): MaybePromise<string> {
        return `http://${location}`;
    }

}

/**
 * `file` URI location mapper.
 */
@injectable()
export class FileLocationMapper implements LocationMapper {

    canHandle(location: string): MaybePromise<number> {
        return location.startsWith('file://') ? 1 : 0;
    }

    map(location: string): MaybePromise<string> {
        const uri = new URI(location);
        if (uri.scheme !== 'file') {
            throw new Error(`Only URIs with 'file' scheme can be mapped to an URL. URI was: ${uri}.`);
        }
        let rawLocation = uri.withoutScheme().toString();
        if (rawLocation.charAt(0) === '/') {
            rawLocation = rawLocation.substr(1);
        }
        return new MiniBrowserEndpoint().getRestUrl().resolve(rawLocation).toString();
    }

}

export class MiniBrowserEndpoint extends Endpoint {
    constructor() {
        super({ path: 'mini-browser' });
    }
}
