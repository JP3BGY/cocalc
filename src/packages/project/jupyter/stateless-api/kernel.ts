import { JupyterKernel } from "@cocalc/project/jupyter/jupyter";
import { run_cell, Limits } from "@cocalc/project/nbgrader/jupyter-run";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import getLogger from "@cocalc/backend/logger";
import { reuseInFlight } from "async-await-utils/hof";
import { path_split } from "@cocalc/util/misc";

const log = getLogger("jupyter:stateless-api:kernel");

const DEFAULT_POOL_SIZE = 2;
const DEFAULT_POOL_TIMEOUT_S = 3600;

// When we idle timeout we always keep at least this many kernels around.  We don't go to 0.
const MIN_POOL_SIZE = 1;

export default class Kernel {
  private static pools: { [kernelName: string]: Kernel[] } = {};
  private static last_active: { [kernelName: string]: number } = {};

  private kernel?: JupyterKernel;
  private tempDir: string;

  constructor(private kernelName: string) {
    this.init = reuseInFlight(this.init.bind(this));
  }

  private static getPool(kernelName: string) {
    let pool = Kernel.pools[kernelName];
    if (pool == null) {
      pool = Kernel.pools[kernelName] = [];
    }
    return pool;
  }

  // Set a timeout for a given kernel pool (for a specifically named kernel)
  // to determine when to clear it if no requests have been made.
  private static setIdleTimeout(kernelName: string, timeout_s: number) {
    if (!timeout_s) {
      // 0 = no timeout
      return;
    }
    const now = Date.now();
    Kernel.last_active[kernelName] = now;
    setTimeout(() => {
      if (Kernel.last_active[kernelName] > now) {
        // kernel was requested after now.
        return;
      }
      // No recent request for kernelName.
      // Keep at least MIN_POOL_SIZE in Kernel.pools[kernelName]. I.e.,
      // instead of closing and deleting everything, we just want to
      // shrink the pool to MIN_POOL_SIZE.
      // no request for kernelName, so we clear them from the pool
      const poolToShrink = Kernel.pools[kernelName] ?? [];
      if (poolToShrink.length > MIN_POOL_SIZE) {
        // check if pool needs shrinking
        // calculate how many to close
        const numToClose = poolToShrink.length - MIN_POOL_SIZE;
        for (let i = 0; i < numToClose; i++) {
          poolToShrink[i].close(); // close oldest kernels first
        }
        // update pool to have only the most recent kernels
        Kernel.pools[kernelName] = poolToShrink.slice(numToClose);
      }
    }, (timeout_s ?? DEFAULT_POOL_TIMEOUT_S) * 1000);
  }

  // This gets a JupyterKernel object and configure it to have
  // the given name and path.  It is NOT async, though it does
  // start chdir and init as soon as it is called.  It returns
  // null if nothing was available in the pool, and in that case
  // it also replenishes the pool.
  static getJupyterKernelFromPool(
    { name, path, actions }: { name: string; path: string; actions? },
    opts?
  ): JupyterKernel | null {
    let k;
    try {
      const pool = Kernel.getPool(name);
      log.debug(`getJupyterKernelFromPool(${name}), pool size = `, pool.length);
      if (pool.length == 0) {
        return null;
      }
      k = pool.shift();
      if (k == null) {
        return null;
      }
    } finally {
      // no matter what we always fill the pool.
      this.fillPool(name, opts);
    }
    k.kernel.setPath(path);
    k.kernel.setActions(actions);
    (async () => {
      await k.init();
      const { head } = path_split(path);
      await k.chdir(head);
      if (k.tempDir) {
        // get rid of the tmpdir:
        try {
          await rm(k.tempDir, { force: true, recursive: true });
        } catch (err) {
          log.warn("Error cleaning up temporary directory", err);
        }
      }
    })();
    return k.kernel;
  }

  private static fillPool(
    kernelName: string,
    {
      size = DEFAULT_POOL_SIZE,
      timeout_s = DEFAULT_POOL_TIMEOUT_S,
    }: { size?: number; timeout_s?: number } = {}
  ) {
    this.setIdleTimeout(kernelName, timeout_s);
    const pool = Kernel.getPool(kernelName);
    let i = 1;
    log.debug(`fillPool(${kernelName}), cur=`, pool.length, ", goal=,", size);
    while (pool.length <= size) {
      // <= since going to remove one below
      const k = new Kernel(kernelName);
      // we cause this kernel to get init'd soon, but NOT immediately, since starting
      // several at once just makes them all take much longer exactly when the user
      // most wants to use their new kernel
      setTimeout(async () => {
        try {
          await k.init();
        } catch (err) {
          log.debug("Failed to pre-init Jupyter kernel -- ", kernelName, err);
        }
      }, 3000 * i); // stagger startup by a few seconds, though kernels that are needed will start ASAP.
      i += 1;
      pool.push(k);
    }
  }

  static async getFromPool(kernelName: string, opts?): Promise<Kernel> {
    this.fillPool(kernelName, opts);
    const pool = Kernel.getPool(kernelName);
    const k = pool.shift() as Kernel;
    // it's ok to call again due to reuseInFlight and that no-op after init.
    await k.init();
    return k;
  }

  private async init() {
    if (this.kernel != null) {
      // already initialized
      return;
    }
    this.tempDir = await mkdtemp(join(tmpdir(), "cocalc"));
    const path = `${this.tempDir}/execute.ipynb`;
    // TODO: make this configurable as part of the API call
    // I'm having a lot of trouble with this for now.
    //   -n = max open files
    //   -f = max bytes allowed to *write* to disk
    //   -t = max cputime is 30 seconds
    //   -v = max virtual memory usage to 3GB
    this.kernel = new JupyterKernel(this.kernelName, path);
    await this.kernel.ensure_running();
    await this.kernel.execute_code_now({ code: "" });
  }

  async execute(
    code: string,
    limits: Limits = {
      timeout_ms: 30000,
      timeout_ms_per_cell: 30000,
      max_output: 5000000,
      max_output_per_cell: 1000000,
      start_time: Date.now(),
      total_output: 0,
    }
  ) {
    if (this.kernel == null) {
      throw Error("kernel already closed");
    }

    if (limits.total_output == null) {
      limits.total_output = 0;
    }
    const cell = { cell_type: "code", source: [code], outputs: [] };
    await run_cell(this.kernel, limits, cell);
    return cell.outputs;
  }

  async chdir(path: string) {
    if (this.kernel == null) return;
    await this.kernel.chdir(path);
  }

  async returnToPool(): Promise<void> {
    if (this.kernel == null) {
      throw Error("kernel already closed");
    }
    const pool = Kernel.getPool(this.kernelName);
    pool.push(this);
  }

  async close() {
    if (this.kernel == null) return;
    try {
      await this.kernel.close();
    } catch (err) {
      log.warn("Error closing kernel", err);
    } finally {
      delete this.kernel;
    }
    if (this.tempDir) {
      try {
        await rm(this.tempDir, { force: true, recursive: true });
      } catch (err) {
        log.warn("Error cleaning up temporary directory", err);
      }
    }
  }
}
