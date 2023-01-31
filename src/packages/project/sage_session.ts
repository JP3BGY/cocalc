/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
//########################################################################
// This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
// License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
//########################################################################

/*
Start the Sage server and also get a new socket connection to it.
*/

import * as async from "async";

import { CoCalcSocket } from "@cocalc/backend/tcp/enable-messaging-protocol";
import { connectToLockedSocket } from "@cocalc/backend/tcp/locked-socket";
import * as message from "@cocalc/util/message";
import { CB } from "@cocalc/util/types/callback";
import * as secret_token from "./servers/secret-token";
import {
  path_split,
  retry_until_success,
  to_json,
  trunc,
  trunc_middle,
  uuid,
} from "@cocalc/util/misc";
import { abspath, enable_mesg, execute_code } from "@cocalc/backend/misc_node";
import { forget_port, get_port } from "./port_manager";
import * as common from "./common";
import processKill from "@cocalc/backend/misc/process-kill";
import { getLogger } from "@cocalc/backend/logger";
import { required, defaults } from "@cocalc/util/misc";

const winston = getLogger("sage-session");

//##############################################
// Direct Sage socket session -- used internally in local hub, e.g., to assist CodeMirror editors...
//##############################################

// Wait up to this long for the Sage server to start responding
// connection requests, after we restart it.  It can
// take a while, since it pre-imports the sage library
// at startup, before forking.
const SAGE_SERVER_MAX_STARTUP_TIME_S = 60;

let _restarting_sage_server = false;
let _restarted_sage_server = 0; // time when we last restarted it
const restart_sage_server = function (cb) {
  const dbg = (m) => winston.debug(`restart_sage_server: ${to_json(m)}`);
  if (_restarting_sage_server) {
    dbg("hit lock");
    cb("already restarting sage server");
    return;
  }
  const t = Date.now() - _restarted_sage_server;
  if (t <= SAGE_SERVER_MAX_STARTUP_TIME_S * 1000) {
    const err = `restarted sage server ${t}ms ago: not allowing too many restarts too quickly...`;
    dbg(err);
    cb(err);
    return;
  }

  _restarting_sage_server = true;
  dbg("restarting the daemon");
  execute_code({
    command: "smc-sage-server restart",
    timeout: 45,
    ulimit_timeout: false, // very important -- so doesn't kill after 30 seconds of cpu!
    err_on_exit: true,
    bash: true,
    cb(err, output) {
      if (err) {
        dbg(`failed to restart sage server daemon -- ${err}`);
      } else {
        dbg(
          `successfully restarted sage server daemon -- '${JSON.stringify(
            output
          )}'`
        );
      }
      _restarting_sage_server = false;
      _restarted_sage_server = Date.now();
      cb(err);
    },
  });
};

// Get a new connection to the Sage server.  If the server
// isn't running, e.g., it was killed due to running out of memory,
// attempt to restart it and try to connect.
const get_sage_socket = function (cb) {
  // cb(err, socket)
  let socket = undefined;
  const try_to_connect = (cb) =>
    _get_sage_socket(function (err, _socket) {
      if (!err) {
        socket = _socket;
        cb();
        return;
      }
      // Failed for some reason: try to restart one time, then try again.
      // We do this because the Sage server can easily get killed due to out of memory conditions.
      // But we don't constantly try to restart the server, since it can easily fail to start if
      // there is something wrong with a local Sage install.
      // Note that restarting the sage server doesn't impact currently running worksheets (they
      // have their own process that isn't killed).
      restart_sage_server(function (err) {
        // won't actually try to restart if called recently.
        if (err) {
          cb(err);
          return;
        }
        // success at restarting sage server: *IMMEDIATELY* try to connect
        _get_sage_socket(function (err, _socket) {
          socket = _socket;
          cb(err);
        });
      });
    });

  retry_until_success({
    f: try_to_connect,
    start_delay: 50,
    max_delay: 5000,
    factor: 1.5,
    max_time: SAGE_SERVER_MAX_STARTUP_TIME_S * 1000,
    log(m) {
      return winston.debug(`get_sage_socket: ${m}`);
    },
    cb(err) {
      cb(err, socket);
    },
  });
};

function _get_sage_socket(cb) {
  // cb(err, socket that is ready to use)
  let sage_socket: CoCalcSocket | undefined = undefined;
  let port: number | undefined = undefined;
  async.series(
    [
      (cb) => {
        winston.debug("get sage server port");
        get_port("sage", (err, _port) => {
          if (err) {
            cb(err);
            return;
          } else {
            port = _port;
            cb();
          }
        });
      },
      async (cb) => {
        if (typeof port !== "number") return cb("port not set");
        winston.debug("get and unlock socket");
        try {
          sage_socket = await connectToLockedSocket({
            port,
            token: secret_token.secretToken,
          });
          winston.debug("Successfully unlocked a sage session connection.");
          cb();
        } catch (error) {
          const err = error;
          forget_port("sage");
          winston.debug(
            `unlock socket: _new_session: sage session denied connection: ${err}`
          );
          cb(`_new_session: sage session denied connection: ${err}`);
        }
      },
      (cb) => {
        if (sage_socket == null) return cb("sage_socket not set");
        winston.debug("request sage session from server.");
        enable_mesg(sage_socket);
        sage_socket.write_mesg("json", message.start_session({ type: "sage" }));
        winston.debug(
          "Waiting to read one JSON message back, which will describe the session...."
        );
        // TODO: couldn't this just hang forever :-(
        sage_socket.once("mesg", (_type, desc) => {
          winston.debug(
            `Got message back from Sage server: ${common.json(desc)}`
          );
          if (sage_socket == null) return cb("sage_socket not set");
          sage_socket.pid = desc.pid;
          cb();
        });
      },
    ],
    (err) => cb(err, sage_socket)
  );
}

const cache = {};

export function sage_session(opts) {
  opts = defaults(opts, {
    client: required,
    path: required,
  }); // the path to the *worksheet* file
  // compute and cache if not cached; otherwise, get from cache:
  return cache[opts.path] != null
    ? cache[opts.path]
    : (cache[opts.path] = new SageSession(opts));
}

//# TODO for project-info/server we need a function that returns a path to a sage worksheet for a given PID
//exports.get_sage_path = (pid) ->
//    return path

/*
Sage Session object

Until you actually try to call it no socket need
*/
class SageSession {
  private _path: string;
  private _client: any;
  private _output_cb: {
    [key: string]: CB<any, { done: true; error: string }>;
  } = {};
  private _socket: CoCalcSocket | undefined;
  private _init_socket_cbs: CB[] | undefined = [];

  constructor(opts) {
    this.dbg = this.dbg.bind(this);
    this.close = this.close.bind(this);
    this.is_running = this.is_running.bind(this);
    this.init_socket = this.init_socket.bind(this);
    this._init_path = this._init_path.bind(this);
    this.call = this.call.bind(this);
    this._handle_mesg_blob = this._handle_mesg_blob.bind(this);
    this._handle_mesg_json = this._handle_mesg_json.bind(this);
    opts = defaults(opts, {
      client: required,
      path: required,
    }); // the path to the *worksheet* file
    this.dbg("constructor")();
    this._path = opts.path;
    this._client = opts.client;
    this._output_cb = {};
  }

  dbg(f) {
    return (m?) =>
      winston.debug(`SageSession(path='${this._path}').${f}: ${m ?? ""}`);
  }

  close() {
    if (this._socket != null) {
      const pid = this._socket.pid;
      if (pid != null) processKill(pid, 9);
    }
    this._socket?.end();
    delete this._socket;
    for (let id in this._output_cb) {
      const cb = this._output_cb[id];
      cb({ done: true, error: "killed" });
    }
    this._output_cb = {};
    delete cache[this._path];
  }

  // return true if there is a socket connection to a sage server process
  is_running() {
    return this._socket != null;
  }

  // NOTE: There can be many simultaneous init_socket calls at the same time,
  // if e.g., the socket doesn't exist and there are a bunch of calls to @call
  // at the same time.
  // See https://github.com/sagemathinc/cocalc/issues/3506
  init_socket(cb): void {
    const dbg = this.dbg("init_socket()");
    dbg();

    if (this._init_socket_cbs != null) {
      this._init_socket_cbs.push(cb);
      return;
    }

    this._init_socket_cbs = [cb];

    get_sage_socket((err, socket) => {
      if (err) {
        dbg(`fail -- ${err}.`);
        const cbs = this._init_socket_cbs ?? [];
        delete this._init_socket_cbs;
        for (const c of cbs) {
          c(err);
        }
        return;
      }

      dbg("successfully opened a sage session");
      this._socket = socket;

      socket.on("end", () => {
        delete this._socket;
        dbg("codemirror session terminated");
      });

      // CRITICAL: we must define this handler before @_init_path below,
      // or @_init_path can't possibly work... since it would wait for
      // this handler to get the response message!
      socket.on("mesg", (type, mesg) => {
        dbg(`sage session: received message ${type}`);
        this[`_handle_mesg_${type}`]?.(mesg);
      });

      this._init_path((err) => {
        const cbs = this._init_socket_cbs ?? [];
        delete this._init_socket_cbs;
        for (const c of cbs) {
          c(err);
        }
      });
    });
  }

  _init_path(cb): void {
    const dbg = this.dbg("_init_path()");
    dbg();
    this.call({
      input: {
        event: "execute_code",
        code: "os.chdir(salvus.data['path']);__file__=salvus.data['file']",
        data: {
          path: abspath(path_split(this._path).head),
          file: abspath(this._path),
        },
        preparse: false,
      },
      cb: (resp) => {
        let err = undefined;
        if (resp.stderr) {
          err = resp.stderr;
          dbg(`error '${err}'`);
        }
        if (resp.done) {
          cb?.(err);
        }
      },
    });
  }

  call(opts) {
    opts = defaults(opts, {
      input: required,
      cb: undefined,
    }); // cb(resp) or cb(resp1), cb(resp2), etc. -- posssibly called multiple times when message is execute or 0 times
    const dbg = this.dbg("call");
    dbg(`input='${trunc(to_json(opts.input), 300)}'`);
    switch (opts.input.event) {
      case "ping":
        opts.cb?.({ pong: true });
        return;
      case "status":
        opts.cb?.({ running: this.is_running() });
        return;
      case "signal":
        if (this._socket != null) {
          dbg(
            `sending signal ${opts.input.signal} to process ${this._socket.pid}`
          );
          const pid = this._socket.pid;
          if (pid != null) processKill(pid, opts.input.signal);
        }
        opts.cb?.({});
        return;
      case "restart":
        dbg("restarting sage session");
        if (this._socket != null) {
          this.close();
        }
        this.init_socket((err) => {
          if (err) {
            opts.cb?.({ error: err });
          } else {
            opts.cb?.({});
          }
        });
        return;
      case "raw_input":
        dbg("sending sage_raw_input event");
        this._socket?.write_mesg("json", {
          event: "sage_raw_input",
          value: opts.input.value,
        });
        return;
      default:
        // send message over socket and get responses
        return async.series(
          [
            (cb) => {
              if (this._socket != null) {
                cb();
              } else {
                this.init_socket(cb);
              }
            },
            (cb) => {
              if (this._socket == null) {
                return cb("no socket"); // should not happen
              }
              if (opts.input.id == null) {
                opts.input.id = uuid();
                dbg(`generated new random uuid for input: '${opts.input.id}' `);
              }
              this._socket.write_mesg("json", opts.input);
              if (opts.cb != null) {
                this._output_cb[opts.input.id] = opts.cb; // this is when opts.cb will get called...
              }
              cb();
            },
          ],
          (err) => {
            if (err) {
              opts.cb?.({ done: true, error: err });
            }
          }
        );
    }
  }
  _handle_mesg_blob(mesg) {
    const { uuid } = mesg;
    const dbg = this.dbg(`_handle_mesg_blob(uuid='${uuid}')`);
    dbg();
    return this._client.save_blob({
      blob: mesg.blob,
      uuid,
      cb: (err, resp) => {
        if (err) {
          resp = message.save_blob({
            error: err,
            sha1: uuid,
          }); // dumb - that sha1 should be called uuid...
        }
        return this._socket?.write_mesg("json", resp);
      },
    });
  }

  _handle_mesg_json(mesg) {
    const dbg = this.dbg("_handle_mesg_json");
    dbg(`mesg='${trunc_middle(to_json(mesg), 400)}'`);
    const c = this._output_cb[mesg?.id];
    if (c != null) {
      // Must do this check first since it uses done:false.
      if (mesg.done || mesg.done == null) {
        delete this._output_cb[mesg.id];
        mesg.done = true;
      }
      if (mesg.done != null && !mesg.done) {
        // waste of space to include done part of mesg if just false for everything else...
        delete mesg.done;
      }
      return c(mesg);
    }
  }
}
