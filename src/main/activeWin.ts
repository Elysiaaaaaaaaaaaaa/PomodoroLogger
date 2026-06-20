import _activeWin, { BaseResult } from 'active-win';
import { execFile } from 'child_process';

let hasPermission = false;
let available = false;
let initialized = false;
let useWindowsFallback = false;

const WINDOWS_ACTIVE_WINDOW_SCRIPT = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class ForegroundWindow {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

$hwnd = [ForegroundWindow]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
    return
}

$titleLength = [ForegroundWindow]::GetWindowTextLength($hwnd)
$builder = New-Object System.Text.StringBuilder ([Math]::Max($titleLength + 1, 1))
[void][ForegroundWindow]::GetWindowText($hwnd, $builder, $builder.Capacity)

[uint32]$processId = 0
[void][ForegroundWindow]::GetWindowThreadProcessId($hwnd, [ref]$processId)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
$path = ''
$name = ''
$memory = 0

if ($process -ne $null) {
    $memory = [int64]$process.WorkingSet64
    $name = $process.ProcessName
    try {
        if ($process.MainModule -ne $null) {
            $path = $process.MainModule.FileName
            $description = $process.MainModule.FileVersionInfo.FileDescription
            if (-not [string]::IsNullOrWhiteSpace($description)) {
                $name = $description
            } elseif (-not [string]::IsNullOrWhiteSpace($process.MainModule.ModuleName)) {
                $name = $process.MainModule.ModuleName
            }
        }
    } catch {}
}

$rect = New-Object ForegroundWindow+RECT
[void][ForegroundWindow]::GetWindowRect($hwnd, [ref]$rect)

[pscustomobject]@{
    platform = 'windows'
    title = $builder.ToString()
    id = $hwnd.ToInt64()
    owner = @{
        name = $name
        processId = [int]$processId
        path = $path
    }
    bounds = @{
        x = $rect.Left
        y = $rect.Top
        width = $rect.Right - $rect.Left
        height = $rect.Bottom - $rect.Top
    }
    memoryUsage = $memory
} | ConvertTo-Json -Compress -Depth 4
`;

function queryWindowsActiveWindow(): Promise<BaseResult | undefined> {
    if (process.platform !== 'win32') {
        return Promise.resolve(undefined);
    }

    return new Promise((resolve) => {
        execFile(
            'powershell.exe',
            [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                WINDOWS_ACTIVE_WINDOW_SCRIPT,
            ],
            {
                encoding: 'utf8',
                maxBuffer: 1024 * 1024,
                timeout: 3000,
                windowsHide: true,
            },
            (error, stdout, stderr) => {
                if (error) {
                    console.warn('Failed to query active window with Windows fallback.', error);
                    if (stderr) {
                        console.warn(stderr);
                    }
                    resolve(undefined);
                    return;
                }

                const output = stdout.trim();
                if (!output) {
                    resolve(undefined);
                    return;
                }

                try {
                    const data = JSON.parse(output) as BaseResult;
                    if (!data.owner || !data.owner.name) {
                        resolve(undefined);
                        return;
                    }

                    resolve(data);
                } catch (e) {
                    console.warn('Failed to parse Windows active window fallback output.', e);
                    resolve(undefined);
                }
            }
        );
    });
}

async function fallbackOnWindows() {
    const fallback = await queryWindowsActiveWindow();
    if (fallback) {
        useWindowsFallback = true;
        available = true;
        return fallback;
    }

    return undefined;
}

export async function initActiveWin() {
    initialized = true;
    try {
        const data = await _activeWin({ screenRecordingPermission: false });
        available = !!data;
    } catch (e) {
        available = false;
        console.warn('Failed to initialize activeWin.', e);
        await fallbackOnWindows();
    }

    if (useWindowsFallback) {
        hasPermission = true;
        console.log('Initialized with activeWin?', available);
        console.log('Initialized with activeWin title permission?', hasPermission);
        return;
    }

    if (available) {
        try {
            await _activeWin({ screenRecordingPermission: true });
            hasPermission = true;
        } catch (e) {
            hasPermission = false;
            console.warn('Failed to initialize activeWin title permission.', e);
        }
    }

    console.log('Initialized with activeWin?', available);
    console.log('Initialized with activeWin title permission?', hasPermission);
}

export async function activeWin() {
    if (useWindowsFallback) {
        return queryWindowsActiveWindow();
    }

    try {
        const data = await _activeWin({
            screenRecordingPermission: initialized && hasPermission,
        });
        available = !!data;
        if (!data) {
            return fallbackOnWindows();
        }

        return data;
    } catch (e) {
        available = false;
        console.warn('Failed to query activeWin.', e);
        return fallbackOnWindows();
    }
}
