const { exec, execSync } = require('child_process');
const { createHash } = require('crypto');

let platform = process.platform;

let win32RegBinPath = {
  native: '%windir%\\System32',
  mixed: '%windir%\\sysnative\\cmd.exe /c %windir%\\System32'
};

function isWindowsProcessMixedOrNativeArchitecture() {
  if (process.platform !== 'win32') {
    return '';
  }
  if (process.arch === 'ia32' && Object.prototype.hasOwnProperty.call(process.env, 'PROCESSOR_ARCHITEW6432')) {
    return 'mixed';
  }
  return 'native';
}

let guid = {
  darwin: 'ioreg -rd1 -c IOPlatformExpertDevice',
  win32:
    `${win32RegBinPath[isWindowsProcessMixedOrNativeArchitecture()]}\\REG.exe ` +
    'QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography ' +
    '/v MachineGuid',
  linux: '( cat /var/lib/dbus/machine-id /etc/machine-id 2> /dev/null || hostname ) | head -n 1 || :',
  freebsd: 'kenv -q smbios.system.uuid || sysctl -n kern.hostuuid'
};

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function expose(result) {
  switch (platform) {
    case 'darwin':
      return result
        .split('IOPlatformUUID')[1]
        .split('\n')[0]
        .replace(/=|\s+|"/gi, '')
        .toLowerCase();
    case 'win32':
      return result
        .toString()
        .split('REG_SZ')[1]
        .replace(/\r+|\n+|\s+/gi, '')
        .toLowerCase();
    case 'linux':
      return result
        .toString()
        .replace(/\r+|\n+|\s+/gi, '')
        .toLowerCase();
    case 'freebsd':
      return result
        .toString()
        .replace(/\r+|\n+|\s+/gi, '')
        .toLowerCase();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function getWindowsMachineId() {
  try {
    const reg = require('native-reg');
    return reg
      .getValue(
        reg.HKEY.LOCAL_MACHINE,
        'SOFTWARE\\Microsoft\\Cryptography',
        'MachineGuid'
      )
      .toString();
  } catch (err) {
    return null;
  }
}

function machineIdSync(original) {
  let error;
  try {
    let id = expose(execSync(guid[platform]).toString());
    return original ? id : hash(id);
  } catch (e) {
    error = e;
  }
  if (platform === 'win32') {
    try {
      let id = getWindowsMachineId();
      if (id) {
        return original ? id : hash(id);
      }
    } catch (e) {
      error = e;
    }
  }
  if (error) {
    // Fallback: stable fallback based on os hostname and user
    const os = require('os');
    const fallbackId = `${os.hostname()}-${os.platform()}-${os.userInfo().username}`;
    return original ? fallbackId : hash(fallbackId);
  }
}

function machineId(original) {
  return new Promise((resolve) => {
    try {
      const id = machineIdSync(original);
      resolve(id);
    } catch (err) {
      resolve(original ? 'fallback-machine-id' : hash('fallback-machine-id'));
    }
  });
}

module.exports = {
  machineId,
  machineIdSync
};
