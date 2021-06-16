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

import { Services } from "../../../src/apiml/Services";
import { ConfigConstants, ImperativeConfig, ImperativeError, PluginManagementFacility, RestClient,
         Session } from "@zowe/imperative";
import { IApimlProfileInfo } from "../../../src/apiml/doc/IApimlProfileInfo";
import * as JSONC from "comment-json";
import { IApimlService } from "../../../src/apiml/doc/IApimlService";
import { IApimlSvcAttrsLoaded } from "../../../src/apiml/doc/IApimlSvcAttrsLoaded";

function genApimlService(apiId: string, serviceId: string, apiVersions: number[] = [1]): IApimlService {
    return {
        serviceId,
        status: "UP",
        apiml: {
            apiInfo: apiVersions.map(apiVersion => (
                {
                    apiId,
                    gatewayUrl: `api/v${apiVersion}`,
                    basePath: `/${serviceId}/api/v${apiVersion}`
                }
            )) as any,
            service: null,
            authentication: [{
                supportsSso: true
            } as any]
        },
        instances: []
    };
}

describe("APIML Services unit tests", () => {

    describe("getPluginApimlConfigs", () => {
        it("should throw an error if Imperative.init has NOT been called", () => {
            let caughtError: Error;
            try {
                Services.getPluginApimlConfigs();
            } catch(error) {
                caughtError = error;
            }
            expect(caughtError).toBeInstanceOf(ImperativeError);
            expect(caughtError.message).toContain("Imperative.init() must be called before getPluginApimlConfigs()");
        });

        it("should form apiml configs for Zowe-CLI and plugins", async () => {
            // get an imperative config from a test file
            const loadedConfigMock = require("./cliImpConfigMock.json");

            // getPluginApimlConfigs calls ImperativeConfig.instance functions
            // that are getters of properties, so mock the getters.
            Object.defineProperty(ImperativeConfig.instance, "loadedConfig", {
                configurable: true,
                get: jest.fn(() => loadedConfigMock)
            });
            Object.defineProperty(ImperativeConfig.instance, "hostPackageName", {
                configurable: true,
                get: jest.fn(() => "@zowe/cli")
            });

            // get all plugin config props from a test file
            const allPluginCfgPropsMock = require("./allPluginCfgPropsMock.json");

            // getPluginApimlConfigs calls PluginManagementFacility.instance functions
            // that are getters of properties, so mock the getters.
            Object.defineProperty(PluginManagementFacility.instance, "allPluginCfgProps", {
                configurable: true,
                get: jest.fn(() => allPluginCfgPropsMock)
            });

            // here's the thing we want to test
            const apimlConfigs = Services.getPluginApimlConfigs();

            // debug: console.log("apimlConfigs:\n" + JSON.stringify(apimlConfigs, null, 2));
            const numOfApimlConfigs = 4;
            const zosmfInx = 0;
            const endvInx1 = 1;
            const endvInx2 = 2;
            const jckInx = 3;

            expect(apimlConfigs.length).toBe(numOfApimlConfigs);

            // we get zosmf from zowe-cli imperative config
            expect(apimlConfigs[zosmfInx].pluginName).toBe("@zowe/cli");

            // we get both entries for endevor
            expect(apimlConfigs[endvInx1].gatewayUrl).toBe("endv_api/v2");
            expect(apimlConfigs[endvInx2].gatewayUrl).toBe("endv_api/v1");

            // we infer the jclcheck profile, which was not specified by that plugin
            expect(apimlConfigs[jckInx].pluginName).toBe("@broadcom/jclcheck-for-zowe-cli");
            expect(apimlConfigs[jckInx].connProfType).toBe("jclcheck");
        });
    });

    describe("getServicesByConfig", () => {
        const tokenSession: Partial<Session> = {
            ISession: {
                type: "token",
                tokenType: "apimlAuthenticationToken",
                tokenValue: "fakeToken"
            }
        };

        it("should require user name for basic sessions", async () => {
            let caughtError;

            try {
                await Services.getServicesByConfig({
                    ISession: {
                        type: "basic",
                        password: "fakePassword"
                    }
                } as any, []);
            } catch (error) {
                caughtError = error;
            }

            expect(caughtError).toBeDefined();
            expect(caughtError.message).toContain("User name for API ML basic login must be defined.");
        });

        it("should require password for basic sessions", async () => {
            let caughtError;

            try {
                await Services.getServicesByConfig({
                    ISession: {
                        type: "basic",
                        user: "fakeUser"
                    }
                } as any, []);
            } catch (error) {
                caughtError = error;
            }

            expect(caughtError).toBeDefined();
            expect(caughtError.message).toContain("Password for API ML basic login must be defined.");
        });

        it("should require APIML authentication token type for token sessions", async () => {
            let caughtError;

            try {
                await Services.getServicesByConfig({
                    ISession: {
                        type: "token",
                        tokenType: "fakeToken",
                        tokenValue: "fakeToken"
                    }
                } as any, []);
            } catch (error) {
                caughtError = error;
            }

            expect(caughtError).toBeDefined();
            expect(caughtError.message).toContain("Token type for API ML token login must be apimlAuthenticationToken.");
        });

        it("should require token value for token sessions", async () => {
            let caughtError;

            try {
                await Services.getServicesByConfig({
                    ISession: {
                        type: "token",
                        tokenType: "apimlAuthenticationToken"
                    }
                } as any, []);
            } catch (error) {
                caughtError = error;
            }

            expect(caughtError).toBeDefined();
            expect(caughtError.message).toContain("Token value for API ML token login must be defined.");
        });

        it("should fail if RestClient throws an error", async () => {
            jest.spyOn(RestClient, "getExpectJSON").mockImplementationOnce(() => {
                throw new Error("Request failed successfully");
            });
            let caughtError;

            try {
                await Services.getServicesByConfig(tokenSession as any, []);
            } catch (error) {
                caughtError = error;
            }

            expect(caughtError).toBeDefined();
            expect(caughtError.message).toContain("Request failed successfully");
        });

        it("should parse simple service list", async () => {
            const services: IApimlService[] = [
                genApimlService("fakeApi", "badService"),
                genApimlService("fakeApi", "goodService")
            ];
            delete services[0].apiml.authentication;
            const configs: IApimlSvcAttrsLoaded[] = [
                {
                    apiId: "fakeApi",
                    connProfType: "fakeProfile",
                    pluginName: "@zowe/fake-plugin"
                }
            ];

            jest.spyOn(RestClient, "getExpectJSON").mockResolvedValueOnce(services);
            const response = await Services.getServicesByConfig(tokenSession as any, configs);

            expect(response).toEqual([
                {
                    profName: "goodService",
                    profType: "fakeProfile",
                    basePaths: ["/goodService/api/v1"],
                    pluginConfigs: new Set(configs),
                    conflictTypes: []
                }
            ]);
        });

        it("should parse complex service list with correct base path priority", async () => {
            const services: IApimlService[] = [
                genApimlService("fakeApi1", "redService", [1, 2]),
                genApimlService("fakeApi2", "greenService", [1, 2, 3]),  // tslint:disable-line no-magic-numbers
                genApimlService("fakeApi3", "blueService", [2, 1])
            ];
            services[0].apiml.apiInfo[0].defaultApi = true;
            services[1].apiml.apiInfo[1].defaultApi = true;
            const configs: IApimlSvcAttrsLoaded[] = [
                {
                    apiId: "fakeApi1",
                    connProfType: "fakeProfile1",
                    gatewayUrl: "api/v2",
                    pluginName: "@zowe/fake-plugin"
                },
                {
                    apiId: "fakeApi2",
                    connProfType: "fakeProfile2",
                    pluginName: "@zowe/fake-plugin"
                },
                {
                    apiId: "fakeApi3",
                    connProfType: "fakeProfile3",
                    pluginName: "@zowe/fake-plugin"
                }
            ];

            jest.spyOn(RestClient, "getExpectJSON").mockResolvedValueOnce(services);
            const response = await Services.getServicesByConfig(tokenSession as any, configs);

            expect(response).toEqual([
                {
                    profName: "redService",
                    profType: "fakeProfile1",
                    basePaths: [
                        "/redService/api/v2"
                    ],
                    pluginConfigs: new Set([configs[0]]),
                    conflictTypes: []
                },
                {
                    profName: "greenService",
                    profType: "fakeProfile2",
                    basePaths: [
                        "/greenService/api/v2",
                        "/greenService/api/v1",
                        "/greenService/api/v3"
                    ],
                    pluginConfigs: new Set([configs[1]]),
                    conflictTypes: []
                },
                {
                    profName: "blueService",
                    profType: "fakeProfile3",
                    basePaths: [
                        "/blueService/api/v2",
                        "/blueService/api/v1"
                    ],
                    pluginConfigs: new Set([configs[2]]),
                    conflictTypes: []
                }
            ]);
        });

        it("should detect base path conflict", async () => {
            const services: IApimlService[] = [
                genApimlService("fakeApi", "myService", [1, 2])
            ];
            const configs: IApimlSvcAttrsLoaded[] = [
                {
                    apiId: "fakeApi",
                    connProfType: "fakeProfile",
                    gatewayUrl: "api/v1",
                    pluginName: "@zowe/fake-plugin"
                },
                {
                    apiId: "fakeApi",
                    connProfType: "fakeProfile",
                    gatewayUrl: "api/v2",
                    pluginName: "@zowe/another-fake-plugin"
                }
            ];

            jest.spyOn(RestClient, "getExpectJSON").mockResolvedValueOnce(services);
            const response = await Services.getServicesByConfig(tokenSession as any, configs);

            expect(response).toEqual([
                {
                    profName: "myService",
                    profType: "fakeProfile",
                    basePaths: [
                        "/myService/api/v1",
                        "/myService/api/v2"
                    ],
                    pluginConfigs: new Set(configs),
                    conflictTypes: ["basePaths"]
                }
            ]);
        });

        it("should detect profile type conflict", async () => {
            const services: IApimlService[] = [
                genApimlService("fakeApi", "oldService", [1]),
                genApimlService("fakeApi", "newService", [2])
            ];
            const configs: IApimlSvcAttrsLoaded[] = [
                {
                    apiId: "fakeApi",
                    connProfType: "fakeProfile",
                    pluginName: "@zowe/fake-plugin"
                }
            ];

            jest.spyOn(RestClient, "getExpectJSON").mockResolvedValueOnce(services);
            const response = await Services.getServicesByConfig(tokenSession as any, configs);

            expect(response).toEqual([
                {
                    profName: "oldService",
                    profType: "fakeProfile",
                    basePaths: ["/oldService/api/v1"],
                    pluginConfigs: new Set([configs[0]]),
                    conflictTypes: ["profType"]
                },
                {
                    profName: "newService",
                    profType: "fakeProfile",
                    basePaths: ["/newService/api/v2"],
                    pluginConfigs: new Set([configs[0]]),
                    conflictTypes: ["profType"]
                }
            ]);
        });
    });

    describe("convertApimlProfileInfoToProfileConfig", () => {
        const testCases: IApimlProfileInfo[] = [
            {
                profName: "test0",
                profType: "type0",
                basePaths: [],
                pluginConfigs: new Set([{
                    apiId: "test0-apiId",
                    connProfType: "type0",
                    pluginName: "type0-plugin-name"
                }]),
                conflictTypes: []
            },
            {
                profName: "test1",
                profType: "type1",
                basePaths: [
                    "test1/v1",
                    "test1/v2",
                    "test1/v3"
                ],
                pluginConfigs: new Set(),
                conflictTypes: []
            },
            {
                profName: "test2.1",
                profType: "type2",
                basePaths: [
                    "test2.1/v1"
                ],
                pluginConfigs: new Set(),
                conflictTypes: [
                    "profType"
                ]
            },
            {
                profName: "test2.2",
                profType: "type2",
                basePaths: [
                    "test2.2/v1"
                ],
                pluginConfigs: new Set(),
                conflictTypes: [
                    "profType"
                ]
            },
            {
                profName: "test3",
                profType: "type3",
                basePaths: [
                    "test3/v1",
                    "test3/v1"
                ],
                pluginConfigs: new Set(),
                conflictTypes: [
                    "basePaths"
                ]
            },
            {
                profName: "test4.1",
                profType: "type4",
                basePaths: [
                    "test4/v1",
                    "test4/v2"
                ],
                pluginConfigs: new Set(),
                conflictTypes: [
                    "basePaths",
                    "profType"
                ]
            },
            {
                profName: "test4.2",
                profType: "type4",
                basePaths: [
                    "test4/v1",
                    "test4/v2"
                ],
                pluginConfigs: new Set(),
                conflictTypes: [
                    "basePaths",
                    "profType"
                ]
            }
        ];

        it("should produce json object with commented conflicts", () => {
            const expectedJson = `{
    "profiles": {
        "test0": {
            "type": "type0",
            "properties": {}
        },
        "test1": {
            "type": "type1",
            "properties": {
                // Multiple base paths were detected for this service.
                // Uncomment one of the lines below to use a different one.
                //"basePath": "test1/v2"
                //"basePath": "test1/v3"
                "basePath": "test1/v1"
            }
        },
        "test2.1": {
            "type": "type2",
            "properties": {
                "basePath": "test2.1/v1"
            }
        },
        "test2.2": {
            "type": "type2",
            "properties": {
                "basePath": "test2.2/v1"
            }
        },
        "test3": {
            "type": "type3",
            "properties": {
                // Multiple base paths were detected for this service.
                // Uncomment one of the lines below to use a different one.
                //"basePath": "test3/v1"
                "basePath": "test3/v1"
            }
        },
        "test4.1": {
            "type": "type4",
            "properties": {
                // Multiple base paths were detected for this service.
                // Uncomment one of the lines below to use a different one.
                //"basePath": "test4/v2"
                "basePath": "test4/v1"
            }
        },
        "test4.2": {
            "type": "type4",
            "properties": {
                // Multiple base paths were detected for this service.
                // Uncomment one of the lines below to use a different one.
                //"basePath": "test4/v2"
                "basePath": "test4/v1"
            }
        }
    },
    "defaults": {
        "type0": "test0",
        "type1": "test1",
        "type3": "test3",
        // Multiple services were detected.
        // Uncomment one of the lines below to set a different default
        //"type2": "test2.2"
        "type2": "test2.1",
        // Multiple services were detected.
        // Uncomment one of the lines below to set a different default
        //"type4": "test4.2"
        "type4": "test4.1"
    },
    "plugins": [
        "type0-plugin-name"
    ]
}`;
            expect(JSONC.stringify(Services.convertApimlProfileInfoToProfileConfig(testCases), null, ConfigConstants.INDENT)).toMatchSnapshot();
            expect(JSONC.stringify(Services.convertApimlProfileInfoToProfileConfig(testCases), null, ConfigConstants.INDENT)).toEqual(expectedJson);
        });
    });

});
