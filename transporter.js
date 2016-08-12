/*
 *  transporter.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-08-10
 *
 *  A Redis Transporter
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

const iotdb = require('iotdb');
const _ = iotdb._;
const iotdb_transport = require('iotdb-transport');
const errors = require('iotdb-errors');

const assert = require('assert');
const redis_scanner = require('redis-scanner');

const logger = iotdb.logger({
    name: 'iotdb-transport-redis',
    module: 'transporter',
});

const make = (initd, redis_client) => {
    const self = iotdb_transport.make();

    const _redis_client = redis_client;
    assert.ok(_redis_client);

    const _initd = _.d.compose.shallow(
        initd, {
            channel: iotdb_transport.channel,
            unchannel: iotdb_transport.unchannel,
            encode: s => s.replace(/[\/$%#.\]\[]/g, (c) => '%' + c.charCodeAt(0).toString(16)),
            decode: s => decodeURIComponent(s),
            unpack: (d, id, band) => JSON.parse(d.toString ? d.toString() : d),
            pack: (d, id, band) => JSON.stringify(d),
        },
        iotdb.keystore().get("/transports/iotdb-transport-redis/initd"), {
            prefix: "/",
        }
    );

    /*
    self.rx.put = (observer, d) => {
        _redis_client.ensure(error => {
            if (error) {
                return observer.onError(error);
            }

            const topic = _initd.channel(_initd, d.id, d.band);
            const message = _initd.pack(d.value, d.id, d.band);

            if (_initd.verbose) {
                logger.info({
                    topic: topic,
                    message: message,
                    message_type: typeof message,
                }, "VERBOSE: sending message");
            }

            _redis_client.publish(topic, message, {
                retain: _initd.retain,
                qos: _initd.qos,
            }, error => {
                if (error) {
                    return observer.onError(error);
                }

                observer.onNext(_.d.clone.shallow(d));
                observer.onCompleted();
            });
        });
    };
     */


    self.rx.list = (observer, d) => {
        const channel = _initd.channel(_initd);

        const seend = {};
        const scanner = new redis_scanner.Scanner(_redis_client, 'SCAN', null, {
            pattern: channel + "*",
            onData: (topic) => {
                const td = _initd.unchannel(_initd, topic);

                if (seend[td.id]) {
                    return;
                }

                seend[td.id] = true;

                const rd = _.d.clone.shallow(d);
                rd.id = td.id;
                
                observer.onNext(rd);
            },
            onEnd: function (error) {
                if (error) {
                    return observer.onError(error);
                }

                observer.onCompleted();
            }
        }).start();
    };

    self.rx.added = (observer, d) => {
        observer.onCompleted();
    };

    self.rx.put = (observer, d) => {
        observer.onCompleted();
    };
    
    self.rx.get = (observer, d) => {
        observer.onCompleted();
    };
    
    self.rx.bands = (observer, d) => {
        observer.onCompleted();
    };

    self.rx.updated = (observer, d) => {
        observer.onCompleted();
    };

    return self;
};

/**
 *  API
 */
exports.make = make;
