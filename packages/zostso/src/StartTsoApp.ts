/*
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { AbstractSession, Headers } from "@zowe/imperative";
import { ZosmfRestClient } from "@zowe/core-for-zowe-sdk";
import { IStartTsoParms } from "./doc/input/IStartTsoParms";
import { TsoValidator } from "./TsoValidator";
import { noAccountNumber, TsoConstants } from "./TsoConstants";
import { IStartASAppResponse } from "./doc/IStartASAppResponse";
import { IStartTsoAppParms } from "./doc/input/IStartTsoAppParms";
import { StartTso } from "./StartTso";
import { IIssueResponse } from "../src";
/**
 * Start TSO address space and receive servlet key
 * @export
 * @class StartTsoApp
 */
export class StartTsoApp {
    /**
     * Start TSO application at address space with provided parameters.
     * @static
     * @param {AbstractSession} session - z/OSMF connection info
     * @param {string}  accountNumber - this key of IStartTsoParms required, because it cannot be default.
     * @param {IStartTsoParms} parms - optional object with required parameters, @see {IStartTsoParms}
     * @returns {Promise<IStartASAppResponse>} command response on resolve, @see {IStartASAppResponse}
     * @memberof StartTso
     */
    public static async start(
        session: AbstractSession,
        accountNumber: string,
        params: IStartTsoAppParms,
        startParms: IStartTsoParms
    ): Promise<IStartASAppResponse> {
        TsoValidator.validateSession(session);
        TsoValidator.validateNotEmptyString(
            accountNumber,
            noAccountNumber.message
        );

        // Address space is not known and must be created
        if (!params.queueID || !params.servletKey) {
            const response: IIssueResponse = {
                success: false,
                startResponse: await StartTso.start(
                    session,
                    accountNumber,
                    startParms
                ),
                startReady: false,
                zosmfResponse: null,
                commandResponse: null,
                stopResponse: null,
            };
            // Reassigning servletKey and queueID so the application can be started at the correct location
            params.servletKey =
                response.startResponse.zosmfTsoResponse.servletKey;
            params.queueID = response.startResponse.zosmfTsoResponse.queueID;
        }

        // Address space application starting
        const endpoint = `${TsoConstants.RESOURCE}/app/${params.servletKey}/${params.appKey}`;
        const apiResponse = await ZosmfRestClient.postExpectJSON<any>(
            session,
            endpoint,
            [Headers.APPLICATION_JSON],
            {
                startcmd: `${params.startupCommand} '&1 &2 ${params.queueID}'`,
            }
        );
        const formattedApiResponse: IStartASAppResponse = {
            version: apiResponse.ver,
            reused: apiResponse.reused,
            timeout: apiResponse.timeout,
            servletKey: apiResponse.servletKey ?? null,
            queueID: apiResponse.queueID ?? null,
            tsoData: apiResponse.tsoData.map((message: any) => ({
                VERSION: message["TSO MESSAGE"].VERSION,
                DATA: message["TSO MESSAGE"].DATA,
            })),
        };

        return formattedApiResponse;
    }
}
