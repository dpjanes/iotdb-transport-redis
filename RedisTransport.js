/*
 *  RedisTransport.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-05
 *
 *  Copyright [2013-2015] [David P. Janes]
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

var iotdb = require('iotdb');
var iotdb_transport = require('iotdb-transport');
var errors = iotdb_transport.errors;
var _ = iotdb._;

var redis = require('redis');
var redis_scanner = require('redis-scanner');

var path = require('path');
var async = require('async');

var util = require('util');
var events = require('events');
var url = require('url');

var logger = iotdb.logger({
    name: 'iotdb-transport-redis',
    module: 'RedisTransport',
});

var _encode;
var _decode;
var _pack;
var _unpack;

/* --- useful to extract --- */
var _setup_initd = function(initd) {
    return _.d.compose.shallow(
        initd, {
            channel: iotdb_transport.channel,
            unchannel: iotdb_transport.unchannel,
            encode: _encode,
            decode: _decode,
            pack: _pack,
            unpack: _unpack,
        },
        iotdb.keystore().get("/transports/RedisTransport/initd"), {
            prefix: "/",
            auth: null,
            host: "127.0.0.1",
            port: 6379,
            db: 2,
            add_timestamp: true,
            check_timestamp: true,
            pubsub: true,
            verbose: false,
        }
    );
};

var _connect = function(initd, done) {
    logger.info({
        method: "_connect",
        host: initd.host,
        port: initd.port,
    }, "connecting to Redis");

    const connectd = {
        native: null,
        pub: null,
        sub: null,
    };

    connectd.native = redis.createClient({
        host: initd.host,
        no_ready_check: true,
    });

    if (initd.pubsub) {
        connectd.pub = redis.createClient({
            host: initd.host,
            no_ready_check: true,
        });

        connectd.sub = redis.createClient({
            host: initd.host,
            no_ready_check: true,
        });
    }

    logger.info({
        method: "_connect",
    }, "authorizing");

    /* authorization sequence */
    var ops = [];

    if (initd.password) {
        ops.push(_.bind(connectd.native.auth, connectd.native, initd.password));
        if (initd.pubsub) {
            ops.push(_.bind(connectd.pub.auth, connectd.pub, initd.password));
            ops.push(_.bind(connectd.sub.auth, connectd.sub, initd.password));
        }
    }

    if (initd.db) {
        ops.push(_.bind(connectd.native.select, connectd.native, parseInt(initd.db)));
    }

    ops.push(function (callback) {
        callback(null, null);
    });

    /* do it */
    async.series(ops, function (error, result) {
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
};

var connect = function(initd, done) {
    return _connect(_setup_initd(initd), done);
};


/* --- constructor --- */

/**
 *  Create a transport for Redis.
 */
var RedisTransport = function (initd, connectd) {
    var self = this;

    self.initd = _.defaults(
        initd, {
            channel: iotdb_transport.channel,
            unchannel: iotdb_transport.unchannel,
            encode: _encode,
            decode: _decode,
            pack: _pack,
            unpack: _unpack,
        },
        iotdb.keystore().get("/transports/RedisTransport/initd"), {
            prefix: "/",
            auth: null,
            host: "127.0.0.1",
            port: 6379,
            db: 2,
            add_timestamp: true,
            check_timestamp: true,
            pubsub: true,
            verbose: false,
        }
    );

    self._emitter = new events.EventEmitter();

    if (connectd) {
        self.native = connectd.native;
        self.pub = connectd.pub;
        self.sub = connectd.sub;
        self.ready = true;

        self._emitter.emit("ready");
    } else {
        self.ready = null;

        // do not use these directly, use the _redis_* functions
        self.native = null;
        self.pub = null;
        self.sub = null;

        this._setup_redis();
    }
};

RedisTransport.prototype = new iotdb_transport.Transport();
RedisTransport.prototype._class = "RedisTransport";

RedisTransport.prototype._setup_redis = function () {
    var self = this;

    _connect(self.initd, function(error, connectd) {
        if (error) {
            logger.error({
                method: "_setup_redis/_connect",
                error: _.error.message(error),
            }, "error authorizing");

            self.ready = false;
        } else {
            logger.info({
                method: "_setup_redis/_connect",
            }, "ready");

            self.native = connectd.native;
            self.pub = connectd.pub;
            self.sub = connectd.sub;
            self.ready = true;

            self.ready = true;
        }

        self._emitter.emit("ready");
    });
};

RedisTransport.prototype._redis_client = function (callback) {
    var self = this;

    if (self.ready) {
        callback(null, self.native);
    } else if (self.ready === false) {
        logger.error({
            method: "_redis_client",
            cause: "check earlier error messages",
        }, "Redis not available");

        callback(new Error("redis not available"));
    } else if (self.ready === null) {
        self._emitter.once("ready", function () {
            if (self.ready !== null) {
                self._redis_client(callback);
            }
        });
    }
};

RedisTransport.prototype._redis_pub = function (callback) {
    var self = this;

    if (!self.initd.pubsub) {
        callback(null, null);
    } else if (self.ready) {
        callback(null, self.pub);
    } else if (self.ready === false) {
        callback(new Error("redis not available"));
    } else if (self.ready === null) {
        self._emitter.once("ready", function () {
            if (self.ready !== null) {
                self._redis_pub(callback);
            }
        });
    }
};

RedisTransport.prototype._redis_publish = function (channel, callback) {
    var self = this;
    callback = callback || _.noop;

    self._redis_pub(function (error, pub) {
        if (pub) {
            pub.publish(channel, "", function (error) {
                callback(error || null, null);
            });
        } else {
            callback(null, null);
        }
    });
};

RedisTransport.prototype._redis_sub = function (callback) {
    var self = this;

    if (!self.initd.pubsub) {
        callback(null, null);
    } else if (self.ready) {
        callback(null, self.sub);
    } else if (self.ready === false) {
        callback(new Error("redis not available"));
    } else if (self.ready === null) {
        self._emitter.once("ready", function () {
            if (self.ready !== null) {
                self._redis_sub(callback);
            }
        });
    }
};


/* --- methods --- */

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.list = function (paramd, callback) {
    var self = this;
    var ld;

    self._validate_list(paramd, callback);

    var channel = self.initd.channel(self.initd, paramd.id);

    self._redis_client(function (error, client) {
        if (error) {
            ld = _.d.clone.shallow(paramd);
            return callback(error, ld);
        }

        var seend = {};
        var scanner = new redis_scanner.Scanner(client, 'SCAN', null, {
            pattern: channel + "*",
            onData: function (topic) {
                var parts = self.initd.unchannel(self.initd, topic);
                if (!parts) {
                    return;
                }

                var topic_id = parts[0];
                if (seend[topic_id]) {
                    return;
                }

                seend[topic_id] = true;

                ld = _.d.clone.shallow(paramd);
                ld.id = topic_id;

                callback(null, ld);
            },
            onEnd: function (err) {
                callback(null, null);
            }
        }).start();
    });
};

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.added = function (paramd, callback) {
    var self = this;

    self._validate_added(paramd, callback);

    var channel = self.initd.channel(self.initd, paramd.id);
};

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.get = function (paramd, callback) {
    var self = this;

    self._validate_get(paramd, callback);

    var channel = self.initd.channel(self.initd, paramd.id, paramd.band);

    var cd = _.d.clone.shallow(paramd);
    cd.value = null;

    // XXX - should differentiate between NotFound and network errors
    self._redis_client(function (error, client) {
        if (error) {
            return callback(error, cd);
        }

        client.get(channel, function (error, result) {
            if (error) {
                return callback(error, cd);
            }

            cd.value = self.initd.unpack(result);
            callback(null, cd);
        });
    });
};

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.put = function (paramd, callback) {
    var self = this;

    self._validate_update(paramd, callback);

    var cd = _.d.clone.shallow(paramd);

    if (self.initd.add_timestamp) {
        cd.value = _.timestamp.add(cd.value);
    }

    var channel = self.initd.channel(self.initd, paramd.id, paramd.band);
    var packed = self.initd.pack(cd.value, paramd.id, paramd.band);

    if (self.initd.verbose) {
        logger.info({
            channel: channel,
            value: cd.value,
        }, "sending message");
    }

    self._redis_client(function (error, client) {
        if (error) {
            return callback(error, cd);
        }

        var _set = function () {
            client.set(channel, packed, function (error) {
                if (error) {
                    return callback(error, cd);
                }

                self._redis_publish(channel, function (error) {
                    return callback(null, cd);
                });
            });
        };

        if (!self.initd.check_timestamp) {
            _set();
        } else {
            client.get(channel, function (error, result) {
                var old_value = self.initd.unpack(result);

                if (error) {
                    _set();
                } else if (!result) {
                    _set();
                } else if (_.timestamp.check.dictionary(old_value, cd.value)) {
                    _set();
                } else {
                    callback(new errors.Timestamp(), cd);
                }
            });
        }
    });
};

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.updated = function (paramd, callback) {
    var self = this;

    self._validate_updated(paramd, callback);

    paramd = _.d.clone.shallow(paramd);

    var channel = self.initd.channel(self.initd, paramd.id || "*", paramd.band || "*");

    var _on_pmessage = function (pattern, topic, value) {
        var parts = self.initd.unchannel(self.initd, topic);
        if (!parts) {
            return;
        }

        var topic_id = parts[0];
        var topic_band = parts[1];

        if (paramd.id && (topic_id !== paramd.id)) {
            return;
        }
        if (paramd.band && (topic_band !== paramd.band)) {
            return;
        }

        var cd = _.d.clone.shallow(paramd);
        cd.id = topic_id || null;
        cd.band = topic_band || null;
        cd.value = undefined;

        callback(null, cd);
    };

    self._redis_sub(function (error, sub) {
        if (error) {
            return callback(error, paramd);
        }

        if (!sub) {
            return;
        }

        if (self.initd.verbose) {
            logger.info({
                method: "updated/_redis_sub",
                channel: channel,
            }, "subscribing");
        }

        self.sub.on("pmessage", _on_pmessage);
        sub.psubscribe(channel);
    });
};

/**
 *  See {iotdb_transport.Transport#bands} for documentation.
 */
RedisTransport.prototype.bands = function (paramd, callback) {
    var self = this;

    self._validate_bands(paramd, callback);

    var bd = _.d.clone.shallow(paramd);

    callback(new errors.NotImplemented(), bd); // RD
};

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.remove = function (paramd, callback) {
    var self = this;

    self._validate_remove(paramd, callback);

    var rd = _.d.clone.shallow(paramd);
    delete rd.band;
    delete rd.value;

    callback(new errors.NotImplemented(), rd);
};

/* --- internals --- */

_encode = function (s) {
    return s.replace(/[\/$%#.\]\[]/g, function (c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
};

_decode = function (s) {
    return decodeURIComponent(s);
};

_unpack = function (v) {
    return JSON.parse(v);
};

_pack = function (d) {
    return JSON.stringify(_.d.transform(d, {
        pre: _.ld_compact,
    }));
};

/**
 *  API
 */
exports.RedisTransport = RedisTransport;
exports.connect = connect;
