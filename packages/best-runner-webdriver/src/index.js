import { getSystemInfo } from '@best/utils';
import { remote as webdriverio } from 'webdriverio';
import merge from 'deepmerge';
import express from 'express';
import { dirname, basename } from 'path';
import { spawn } from 'child_process';

const UPDATE_INTERVAL = 500;
const WEBDRIVERIO_OPTIONS = {
    desiredCapabilities: {
        timeouts: { "implicit": 0, "pageLoad": 300000, "script": 120000 },
    },
    host: "localhost",
    port: "4444",
};

function normalizeRuntimeOptions(projectConfig) {
    const { benchmarkIterations, benchmarkOnClient } = projectConfig;
    const definedIterations = Number.isInteger(benchmarkIterations);
    // For benchmarking on the client or a defined number of iterations duration is irrelevant
    const maxDuration = definedIterations ? 1 : projectConfig.benchmarkMaxDuration;
    const minSampleCount = definedIterations ? benchmarkIterations : projectConfig.benchmarkMinIterations;

    return {
        maxDuration,
        minSampleCount,
        iterations: benchmarkIterations,
        iterateOnClient: benchmarkOnClient,
    };
}

function initializeBenchmarkState(opts) {
    return {
        executedTime: 0,
        executedIterations: 0,
        results: [],
        iterateOnClient: opts.iterateOnClient,
    };
}

async function normalizeEnvironment(browser, projectConfig, globalConfig, webdriverOptions) {
    const {
        benchmarkOnClient,
        benchmarkRunner,
        benchmarkEnvironment,
        benchmarkIterations,
        projectName,
    } = projectConfig;
    const { system, cpu, os, load } = await getSystemInfo();
    const version = `${browser.desiredCapabilities.browserName} ${browser.desiredCapabilities.version}`;
    return {
        hardware: { system, cpu, os },
        runtime: { load },
        browser: { version, options: webdriverOptions },
        configuration: {
            project: {
                projectName,
                benchmarkOnClient,
                benchmarkRunner,
                benchmarkEnvironment,
                benchmarkIterations,
            },
            global: {
                gitCommitHash: globalConfig.gitCommit,
                gitHasLocalChanges: globalConfig.gitLocalChanges,
                gitBranch: globalConfig.gitBranch,
                gitRepository: globalConfig.gitRepository,
            },
        },
    };
}

function runIteration(page, state, opts) {
    // eslint-disable-next-line prefer-arrow-callback
    return page.executeAsync(function (o, done) {
        // eslint-disable-next-line no-undef
        BEST.runBenchmark(o)
            // eslint-disable-next-line prefer-arrow-callback
            .then(function (data) {
                done(data);
            })
            // eslint-disable-next-line prefer-arrow-callback
            .catch(function (e) {
                throw e;
            });
    }, opts);
}

async function runIterations(page, state, opts, messager) {
    // Run an iteration to estimate the time it will take
    const result = await runIteration(page, state, { iterations: 1 });
    const testResult = result.value;
    const estimatedIterationTime = testResult.executedTime;

    const start = Date.now();
    // eslint-disable-next-line lwc/no-set-interval
    const intervalId = setInterval(() => {
        const executing = Date.now() - start;
        state.executedTime = executing;
        state.executedIterations = Math.round(executing / estimatedIterationTime);
        messager.updateBenchmarkProgress(state, opts);
    }, UPDATE_INTERVAL);

    await page.refresh();

    const clientRawResults = await runIteration(page, state, opts);
    clearInterval(intervalId);

    const results = clientRawResults.value.results;
    state.results.push(...results);

    return state;
}

export async function run({ benchmarkName, benchmarkEntry }, projectConfig, globalConfig, messager) {
    const opts = normalizeRuntimeOptions(projectConfig);
    const state = initializeBenchmarkState(opts);
    const { projectName, benchmarkRunnerConfig } = projectConfig;
    const webdriverOptions = merge(WEBDRIVERIO_OPTIONS, benchmarkRunnerConfig.webdriverOptions);
    const { openBenchmarks } = globalConfig;

    const dir = dirname(benchmarkEntry);
    const app = await createExpressApp(dir);
    const file = basename(benchmarkEntry);
    const url = `${app.url}/${file}`;

    // Open benchmarks in a browser for debugging.
    if (openBenchmarks) {
        spawn('open', [url]);
    }

    let browser;
    try {
        browser = webdriverio(webdriverOptions);
        const environment = await normalizeEnvironment(browser, projectConfig, globalConfig, webdriverOptions);

        messager.onBenchmarkStart(benchmarkName, projectName);

        const page = browser.init().url(url);

        const { results } = await runIterations(page, state, opts, messager);
        return { results, environment };
    } catch (e) {
        messager.onBenchmarkError(benchmarkName, projectName);
        throw e;
    } finally {
        messager.onBenchmarkEnd(benchmarkName, projectName);

        if (browser) {
            await browser.end();
        }

        // Stop the express app, unless we're opening benchmarks in a browser for debugging.
        if (!openBenchmarks) {
            app.stop();
        }
    }
}

// Create a new express app on a random port.
export async function createExpressApp(staticRoot) {
    return new Promise(resolve => {
        const app = express();
        const server = app.listen(() => {
            app.url = `http://localhost:${server.address().port}`;
            resolve(app);
        });

        // Serve static assets.
        app.use(express.static(staticRoot));

        // Keep track of open sockets.
        const sockets = {};
        let socketId = 0;
        server.on('connection', socket => {
            const id = `s${++socketId}`;
            sockets[id] = socket;
            socket.on('close', () => delete sockets[id]);
        });

        // Stop the server by ending open sockets.
        app.stop = () => {
            server.close();
            Object.values(sockets).forEach(socket => {
                socket.end();
                socket.unref();
            });
        };
    });
}
