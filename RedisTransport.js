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

var noop = function() {};

/* --- constructor --- */

/**
 *  Create a transport for Redis.
 */
var RedisTransport = function (initd) {
    var self = this;

    self.initd = _.defaults(
        initd,
        {
            channel: iotdb_transport.channel,
            unchannel: iotdb_transport.unchannel,
            encode: _encode,
            decode: _decode,
            pack: _pack,
            unpack: _unpack,
        },
        iotdb.keystore().get("/transports/RedisTransport/initd"),
        {
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

    self.ready = null;

    // do not use these directly, use the _redis_* functions
    self.native = null;
    self.pub = null;
    self.sub = null;

    this._setup_redis();
};

RedisTransport.prototype = new iotdb_transport.Transport;
RedisTransport.prototype._class = "RedisTransport";

RedisTransport.prototype._setup_redis = function() {
    var self = this;

    logger.info({
        method: "RedisTransport",
        host: self.initd.host,
        port: self.initd.port,
    }, "connecting to redis");

    self.native = redis.createClient({
        host: self.initd.host,
        no_ready_check: true,
    }); 

    if (self.initd.pubsub) {
        self.pub = redis.createClient({
            host: self.initd.host,
            no_ready_check: true,
        }); 

        self.sub = redis.createClient({
            host: self.initd.host,
            no_ready_check: true,
        }); 
    }

    logger.info({
        method: "RedisTransport/createClient",
    }, "authorizing");

    /* authorization sequence */
    var ops = [];

    if (self.initd.password) {
        ops.push(_.bind(self.native.auth, self.native, self.initd.password));
        if (self.initd.pubsub) {
            ops.push(_.bind(self.pub.auth, self.pub, self.initd.password));
            ops.push(_.bind(self.sub.auth, self.sub, self.initd.password));
        }
    }

    if (self.initd.db) {
        ops.push(_.bind(self.native.select, self.native, parseInt(self.initd.db)));
    }

    ops.push(function(callback) { callback(null, null) });

    /* do it */
    async.series(ops, function(error, result) {
        if (error) {
            logger.error({
                method: "RedisTransport/createClient/client.auth",
                error: _.error.message(error),
            }, "error authorizing");

            self.ready = false;
            return;
        }

        logger.info({
            method: "RedisTransport/createClient",
        }, "ready");

        self.ready = true;
        self._emitter.emit("ready");
    });
};

RedisTransport.prototype._redis_client = function(callback) {
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
        self._emitter.once("ready", function() {
            if (self.ready !== null) {
                self._redis_client(callback);
            }
        });
    }
};

RedisTransport.prototype._redis_pub = function(callback) {
    var self = this;

    if (!self.initd.pubsub) {
        callback(null, null);
    } else if (self.ready) {
        callback(null, self.pub);
    } else if (self.ready === false) {
        callback(new Error("redis not available"));
    } else if (self.ready === null) {
        self._emitter.once("ready", function() {
            if (self.ready !== null) {
                self._redis_pub(callback);
            }
        });
    }
};

RedisTransport.prototype._redis_publish = function(channel, callback) {
    var self = this;
    callback = callback || noop;

    self._redis_pub(function(error, pub) {
        if (pub) {
            pub.publish(channel, "", function(error) {
                callback(error || null, null);
            });
        } else {
            callback(null, null);
        }
    });
};

RedisTransport.prototype._redis_sub = function(callback) {
    var self = this;

    if (!self.initd.pubsub) {
        callback(null, null);
    } else if (self.ready) {
        callback(null, self.sub);
    } else if (self.ready === false) {
        callback(new Error("redis not available"));
    } else if (self.ready === null) {
        self._emitter.once("ready", function() {
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
RedisTransport.prototype.list = function(paramd, callback) {
    var self = this;

    self._validate_list(paramd, callback);

    var cd = _.shallowCopy(paramd);
    var channel = self.initd.channel(self.initd, paramd.id);

    self._redis_client(function(error, client) {
        if (error) {
            cd.error = error;
            return callback(cd);
        }

        var seend = {};
        var scanner = new redis_scanner.Scanner(client, 'SCAN', null, {
            pattern: channel + "*",
            onData: function(topic) {
                var parts = self.initd.unchannel(self.initd, topic);
                if (!parts) {
                    return;
                }

                var topic_id = parts[0];
                if (seend[topic_id]) {
                    return;
                }

                seend[topic_id] = true;

                callback({
                    id: topic_id,
                });
            },
            onEnd: function(err){
                callback({
                    end: true,
                });
            }
        }).start();
    });
};

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.added = function(paramd, callback) {
    var self = this;

    self._validate_added(paramd, callback);

    var channel = self.initd.channel(self.initd, paramd.id);
};

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.get = function(paramd, callback) {
    var self = this;

    self._validate_get(paramd, callback);

    var channel = self.initd.channel(self.initd, paramd.id, paramd.band);

    var cd = _.shallowCopy(paramd);
    cd.value = null;

    // XXX - should differentiate between NotFound and network errors
    self._redis_client(function(error, client) {
        if (error) {
            return callback(error, cd);
        }

        client.get(channel, function(error, result) {
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
RedisTransport.prototype.put = function(paramd, callback) {
    var self = this;

    self._validate_update(paramd, callback);

    var cd = _.shallowCopy(paramd);

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

    self._redis_client(function(error, client) {
        if (error) {
            cd.error = error;
            return callback(cd);
        }

        var _set = function() {
            client.set(channel, packed, function(error) {
                if (error) {
                    cd.error = error;
                    return callback(cd);
                }

                self._redis_publish(channel, function(error) {
                    return callback(cd);
                });
            });
        };

        if (!self.initd.check_timestamp) {
            _set();
        } else {
            client.get(channel, function(error, result) {
                var old_value = self.initd.unpack(result);

                if (error) {
                    _set();
                } else if (!result) {
                    _set();
                } else if (_.timestamp.check.dictionary(old_value, cd.value)) {
                    _set();
                } else {
                    cd.error = new Error("out of date");    // maybe error too strong
                    callback(cd);
                }
            });
        }
    });
};

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.updated = function(paramd, callback) {
    var self = this;

    self._validate_updated(paramd, callback);

    paramd = _.shallowCopy(paramd);

    var channel = self.initd.channel(self.initd, paramd.id || "*", paramd.band || "*");

    var _on_pmessage = function(pattern, topic, value) {
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

        var cd = _.shallowCopy(paramd);
        cd.id = topic_id || null;
        cd.band = topic_band || null;
        cd.value = undefined;

        callback(cd);
    };

    self._redis_sub(function(error, sub) {
        if (error) {
            cd.error = error;
            return callback(cd);
        } else if (!sub) {
            return callback(cd);
        } else {
            if (self.initd.verbose) {
                logger.info({
                    method: "updated/_redis_sub",
                    channel: channel,
                }, "subscribing");
            }

            self.sub.on("pmessage", _on_pmessage);
            sub.psubscribe(channel);
        }
    });
};

/**
 *  See {iotdb_transport.Transport#Transport} for documentation.
 */
RedisTransport.prototype.remove = function(paramd, callback) {
    var self = this;

    self._validate_remove(paramd, callback);

    var channel = self.initd.channel(self.initd, paramd.id, paramd.band);
};

/* --- internals --- */

var _encode = function(s) {
    return s.replace(/[\/$%#.\]\[]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
};

var _decode = function(s) {
    return decodeURIComponent(s);
}

var _unpack = function(v) {
    return JSON.parse(v);
};

var _pack = function(d) {
    return JSON.stringify(_.d.transform(d, {
        pre: _.ld_compact,
    }));
};

/**
 *  API
 */
exports.RedisTransport = RedisTransport;
