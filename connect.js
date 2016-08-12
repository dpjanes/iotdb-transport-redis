/*
 *  connect.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-08-10
 *
 *  Make a MQTT server
 *
 *  Copyright [2013-2016] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict";

// require('longjohn')

const assert = require("assert");

const iotdb = require('iotdb');
const _ = iotdb._;

const iotdb_transport = require('iotdb-transport');
const errors = require('iotdb-errors');

const redis = require('redis');
const async = require('async');

const util = require('util');

const logger = iotdb.logger({
    name: 'iotdb-transport-redis',
    module: 'connect',
});

const _setup_initd = initd => _.d.compose.shallow(
    initd,
    iotdb.keystore().get("/transports/iotdb-transport-redis/initd"), {
        verbose: false,

        prefix: "/",
        auth: null,
        host: null,
        port: 6379,
        db: 2,
        add_timestamp: true,
        check_timestamp: true,
        pubsub: true,
        verbose: false,
    });

const connect = (initd, done) => {
    const _initd = _setup_initd(initd);

    const _redis_client = redis.createClient({
        host: _initd.host,
        no_ready_check: true,
        enable_offline_queue: false,
    });
    _redis_client.__connected_ever = false;
    _redis_client.__connected = false;
    _redis_client.__logged_in = false;

    _redis_client.on("error", error => {
        logger.info({
            method: "connect/on(error)",
            error: _.error.message(error),
        }, "error");

        if (!_redis_client.__connected_ever) {
            _redis_client.removeAllListeners();
            return done(error);
        }
    });
    _redis_client.on("connect", () => {
        _redis_client.__connected = true;
        _redis_client.__connected_ever = true;

        logger.info({
            method: "connect/on(connect)",
        }, "connected");

    });
    _redis_client.on("reconnecting", () => {
        _redis_client.__connected = false;

        logger.info({
            method: "connect/on(reconnecting)",
        }, "reconnecting");
    });
    _redis_client.on("end", () => {
        logger.info({
            method: "connect/on(end)",
        }, "end");
    });

    _redis_client.ensure = (done) => {
        const _check = () => {
            if (_redis_client.__connected && _redis_client.__logged_in) {
                _redis_client.removeListener("connect", _check);
                _redis_client.removeListener("__logged_in", _check);

                done();
                return true;
            }
        }

        if (!_check()) {
            _redis_client.on("connect", _check);
            _redis_client.on("__logged_in", _check);
        }
    };

    logger.info({
        method: "_connect",
    }, "authorizing");

    // authorization sequence 
    const ops = [];

    if (_initd.password) {
        ops.push(_.bind(_redis_client.auth, _redis_client, _initd.password));
    }

    if (_initd.db) {
        ops.push(_.bind(_redis_client.select, _redis_client, parseInt(_initd.db)));
    }

    ops.push(callback => {
        _redis_client.__logged_in = true;
        _redis_client.emit("__logged_in");

        callback(null, null);
    });

    // do it
    async.series(ops, (error, result) => {
        if (error) {
            logger.error({
                method: "_connect/async.series",
                error: _.error.message(error),
            }, "error authorizing");

            return done(error);
        }

        logger.info({
            method: "_connect/async.series",
        }, "ready");

        return done(null, null);
    });

    return _redis_client;
};

/**
 *  API
 */
exports.connect = connect;

