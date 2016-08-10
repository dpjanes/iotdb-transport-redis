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

const path = require('path');
const mqtt = require('mqtt');
const fs = require('fs');

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
    });
    _redis_client.__connected_ever = false;
    _redis_client.__connected = false;

    _redis_client.on("error", error => {
        if (_redis_client.__connected_ever) {
            _redis_client.removeAllListeners();
            return done(error);
        }
    });
    _redis_client.on("connect", error => {
        _redis_client.__connected = true;
        _redis_client.__connected_ever = true;
    });
    _redis_client.on("reconnecting", error => {
        _redis_client.__connected = false;
    });

    _redis_client.ensure = (done) => {
        if (client.__connected) {
            done();
        } else {
            client.once("connect", () => done());
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

        return done(null, connectd);
    });

    return _redis_client;
};

/**
 *  API
 */
exports.connect = connect;

