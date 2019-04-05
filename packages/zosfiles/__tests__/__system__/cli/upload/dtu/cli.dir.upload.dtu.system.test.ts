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

import { Imperative, Session, ImperativeError, Headers } from "@zowe/imperative";

import * as path from "path";
import * as fs from "fs";
import * as buffer from "buffer";
import { runCliScript, getUniqueDatasetName } from "../../../../../../../__tests__/__src__/TestUtils";
import { TestEnvironment } from "../../../../../../../__tests__/__src__/environment/TestEnvironment";
import { ITestEnvironment } from "../../../../../../../__tests__/__src__/environment/doc/response/ITestEnvironment";
import { TestProperties } from "../../../../../../../__tests__/__src__/properties/TestProperties";
import { ITestSystemSchema } from "../../../../../../../__tests__/__src__/properties/ITestSystemSchema";
import { Get, ZosFilesConstants } from "../../../../../index";
import { ZosmfRestClient } from "../../../../../../rest";

let REAL_SESSION: Session;
// Test Environment populated in the beforeAll();
let TEST_ENVIRONMENT: ITestEnvironment;
let TEST_ENVIRONMENT_NO_PROF: ITestEnvironment;
let systemProps: TestProperties;
let defaultSystem: ITestSystemSchema;
let ussname: string;
let binaryFiles: string;
let binaryFile: string;
let asciiFile: string;
let asciiFiles: string;
let dsname: string;

describe("Upload directory to USS", () => {

    beforeAll(async () => {

        TEST_ENVIRONMENT = await TestEnvironment.setUp({
            tempProfileTypes: ["zosmf"],
            testName: "zos_files_upload_directory_to_uss_with_profile"
        });

        systemProps = new TestProperties(TEST_ENVIRONMENT.systemTestProperties);
        defaultSystem = systemProps.getDefaultSystem();

        REAL_SESSION = TestEnvironment.createZosmfSession(TEST_ENVIRONMENT);
        dsname = getUniqueDatasetName(`${defaultSystem.zosmf.user}.ZOSFILE.UPLOAD`);
        dsname = dsname.replace(/\./g, "");
        ussname = `${defaultSystem.unix.testdir}/${dsname}`;
        Imperative.console.info("Using ussDir:" + ussname);
        binaryFile = "bin_file.pax";
        binaryFiles = "bin_file.pax,subdir_bin_file1.pax,subdir_bin_file2.pax.Z";
        asciiFile = "ascii_file.txt";
        asciiFiles = "ascii_file.txt,subdir_ascii_file1.txt,subdir_ascii_file2.txt";
    });

    afterAll(async () => {
        await TestEnvironment.cleanUp(TEST_ENVIRONMENT);
        await TestEnvironment.cleanUp(TEST_ENVIRONMENT_NO_PROF);
    });

    describe("without profiles", () => {
        let sysProps;
        let defaultSys: ITestSystemSchema;

        // Create the unique test environment
        beforeAll(async () => {
            TEST_ENVIRONMENT_NO_PROF = await TestEnvironment.setUp({
                testName: "upload_dir_to_uss"
            });

            sysProps = new TestProperties(TEST_ENVIRONMENT_NO_PROF.systemTestProperties);
            defaultSys = sysProps.getDefaultSystem();

            Imperative.console.info("Using ussDir:" + ussname);
        });

        afterEach(async () => {
            let error;
            let response;

            const endpoint: string = ZosFilesConstants.RESOURCE + ZosFilesConstants.RES_USS_FILES + ussname;

            try {
                response = await ZosmfRestClient.deleteExpectString(REAL_SESSION, endpoint, [{"X-IBM-Option": "recursive"}]);
            } catch (err) {
                error = err;
            }
        });

        it("should upload local directory to USS directory", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/command_upload_dtu_subdir_ascii");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu_fully_qualified.sh");

            const ZOWE_OPT_BASE_PATH = "ZOWE_OPT_BASE_PATH";

            // if API Mediation layer is being used (basePath has a value) then
            // set an ENVIRONMENT variable to be used by zowe.
            if (defaultSys.zosmf.basePath != null) {
                TEST_ENVIRONMENT_NO_PROF.env[ZOWE_OPT_BASE_PATH] = defaultSys.zosmf.basePath;
            }
            const response = runCliScript(shellScript,
                TEST_ENVIRONMENT_NO_PROF,
                [
                    localDirName,
                    ussname,
                    defaultSys.zosmf.host,
                    defaultSys.zosmf.port,
                    defaultSys.zosmf.user,
                    defaultSys.zosmf.pass,
                ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            expect(response.stdout.toString()).toContain("Directory uploaded successfully.");
        });
    });

    describe("Success scenarios", () => {

        afterEach(async () => {
            let error;
            let response;

            const endpoint: string = ZosFilesConstants.RESOURCE + ZosFilesConstants.RES_USS_FILES + ussname;

            try {
                response = await ZosmfRestClient.deleteExpectString(REAL_SESSION, endpoint, [{"X-IBM-Option": "recursive"}]);
            } catch (err) {
                error = err;
            }
        });

        it("should upload local directory to USS directory", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/command_upload_dtu_subdir_ascii");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
            [
                localDirName,
                ussname,
            ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            expect(response.stdout.toString()).toContain("Directory uploaded successfully.");
        });

        it("should upload recursively local directory and subdirectories to USS directory in binary mode", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
                [
                    localDirName,
                    ussname,
                    "--recursive",
                    "--binary"
                ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            expect(response.stdout.toString()).toContain("Directory uploaded successfully.");
        });

        it("should upload local directory to USS directory with binary list files", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
                [
                    localDirName,
                    ussname,
                    "--binary-files " + binaryFile
                ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            expect(response.stdout.toString()).toContain("Directory uploaded successfully.");
        });

        it("should upload local directory to USS directory in binary mode with ascii list files", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
                [
                    localDirName,
                    ussname,
                    "--binary",
                    "--ascii-files " + asciiFile
                ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            expect(response.stdout.toString()).toContain("Directory uploaded successfully.");
        });

        it("should upload recursively local directory and subdirectories to USS directory with binary list files", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
                [
                    localDirName,
                    ussname,
                    "--recursive",
                    "--binary-files " + binaryFiles
                ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            expect(response.stdout.toString()).toContain("Directory uploaded successfully.");
        });

        it("should upload recursively local directory and subdirectories to USS directory in binary mode with ascii list files", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
                [
                    localDirName,
                    ussname,
                    "--binary",
                    "--recursive",
                    "--ascii-files " + asciiFiles
                ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            expect(response.stdout.toString()).toContain("Directory uploaded successfully.");
        });

        it("should give error when upload local directory to USS directory in default ascii if it contains also binary files", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
                [
                    localDirName,
                    ussname,
    ]);
            expect(response.status).toBe(1);
            expect(response.stderr.toString()).toContain("Rest API failure with HTTP(S) status 500");
        });

        it("should upload local directory to USS directory with response-format-json flag", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/command_upload_dtu_subdir_ascii");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
                [
                    localDirName,
                    ussname,
                    "--rfj"
                ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            const stdoutText = response.stdout.toString();
            expect(stdoutText).toContain("\"stdout\": \"success: true");
            expect(stdoutText).toContain(
                "\"commandResponse\": \"Directory uploaded successfully.\"");
        });

        it("should upload local directory to USS directory with --max-concurrent-requests 2", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/command_upload_dtu_subdir_ascii");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
            [
                localDirName,
                ussname,
                "--mcr 2"
            ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            expect(response.stdout.toString()).toContain("Directory uploaded successfully.");
        });

        it("should upload local directory to USS directory with --max-concurrent-requests 0", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/command_upload_dtu_subdir_ascii");
            const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
            const response = runCliScript(shellScript, TEST_ENVIRONMENT,
            [
                localDirName,
                ussname,
                "--mcr 0"
            ]);
            expect(response.stderr.toString()).toBe("");
            expect(response.status).toBe(0);
            expect(response.stdout.toString()).toContain("Directory uploaded successfully.");
        });
    });

    describe ("Scenarios using the .zosattributes file", () => {
        it("should ignore files marked with a -", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/dir_with_ignored_files");
            testSuccessfulUpload(localDirName);

            try {
                await Get.USSFile(REAL_SESSION, path.join(ussname,"foo.ignoreme"));
                fail("USS file foo.stuff should not have been transferred");
            } catch (err) {
                expect(err).toBeDefined();
            }
        });

        it("should ignore nested directories as specified", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/dir_with_ignored_dir");

            testSuccessfulUpload(localDirName, ["--recursive"]);

            let error: Error;
            try {
                await Get.USSFile(REAL_SESSION, path.join(ussname,"uploaded_dir/ignored_dir/ignored_file"));
                fail("USS file ignored_file should not have been transferred");
            } catch (err) {
                error = err;
            }
            expect(error).toBeDefined();

            const ussResponse = await Get.USSFile(REAL_SESSION, path.join(ussname,"uploaded_dir/uploaded_file"));
            expect(ussResponse).toBeInstanceOf(Buffer);
        });

        it("should upload files in binary or text as indicated", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/dir_with_mixed_files");

            testSuccessfulUpload(localDirName);

            const remoteTextFileBuffer = await Get.USSFile(REAL_SESSION, path.join(ussname,"foo.text"));
            const localTextFileBuffer = fs.readFileSync(path.join(localDirName,"foo.text"));
            expect(remoteTextFileBuffer.equals(localTextFileBuffer)).toBeTruthy();

            const remoteBinaryFileBuffer = await Get.USSFile(REAL_SESSION, path.join(ussname,"bar.binary"),{binary: true});
            const localBinaryFileBuffer = fs.readFileSync(path.join(localDirName,"bar.binary"));
            expect(remoteBinaryFileBuffer.equals(localBinaryFileBuffer)).toBeTruthy();
        });
        it("should tag uploaded files according to remote encoding", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/dir_with_mixed_files");

            testSuccessfulUpload(localDirName);

            let tag = await getTag(ussname + "/baz.asciitext");
            expect(tag).toMatch("t ISO8859-1");

            tag = await getTag(ussname + "/foo.text");
            expect(tag).toMatch("t IBM-1047");

            tag = await getTag(ussname + "/bar.binary");
            expect(tag).toMatch("b binary");
        });

        async function getTag(ussPath: string) {
            const request: object = {request:"chtag",
                                     action: "list"};
            const url = ZosFilesConstants.RESOURCE + ZosFilesConstants.RES_USS_FILES
                        + "/" + ussPath;
            Imperative.console.info("z/OSMF URL: "  + url);
            const response = await ZosmfRestClient.putExpectJSON<any>(REAL_SESSION,
                                           url,
                                           [Headers.APPLICATION_JSON, { [Headers.CONTENT_LENGTH] : JSON.stringify(request).length.toString() }],
                                           request);
            return response.stdout[0];
        }

        it("should accept zosattributes path as an argument", async () => {
            const localDirName = path.join(__dirname, "__data__", "command_upload_dtu_dir/command_upload_dtu_subdir_ascii");

            const attributesPath = path.join(__dirname, "__data__", "command_upload_dtu_dir/external.attributes");
            testSuccessfulUpload(localDirName, ["--attributes",attributesPath]);

            let error: Error;
            try {
                await Get.USSFile(REAL_SESSION, path.join(ussname,"subdir_ascii_file1.txt"));
                fail("USS file subddir_ascii_file1.txt should not have been transferred");
            } catch (err) {
                error = err;
            }
            expect(error).toBeDefined();
        });
    });
});

function testSuccessfulUpload(localDirName: string, additionalParameters?: string[]) {
    const shellScript = path.join(__dirname, "__scripts__", "command", "command_upload_dtu.sh");
    let parms: string[] = [
        localDirName,
        ussname
    ];
    if (additionalParameters) {
        parms = parms.concat(additionalParameters);
    }

    const response = runCliScript(shellScript, TEST_ENVIRONMENT, parms);
    expect(response.stderr.toString()).toBe("");
    expect(response.status).toBe(0);
    const stdoutText = response.stdout.toString();
    expect(stdoutText).toContain("Directory uploaded successfully.");
}

