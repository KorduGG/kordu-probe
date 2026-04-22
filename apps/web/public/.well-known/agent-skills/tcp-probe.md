# TCP Probe

Use this skill when you need to ask Kordu Probe for a public connectivity result and interpret the module outputs.

## Inputs

- `target`: a public hostname or IP
- `port`: optional TCP port number
- `modules`: optional module list such as `tcp`, `dns`, `http`, or `ip`

## Output

- per-module results for `tcp`, `dns`, `http`, and `ip`
- `open`, `closed`, or `timeout` when the `tcp` module runs
- latency and redirect data where available
- copyable `curl`, CLI, and PowerShell commands
