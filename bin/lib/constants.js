// CymClaw — shared constants
// SPDX-License-Identifier: Apache-2.0

'use strict';

const SANDBOX_NAME    = 'cymclaw-sandbox';
const GATEWAY_NAME    = 'cymclaw-gateway';
const NETWORK_NAME    = 'cymclaw-isolated';
const SANDBOX_IMAGE   = 'cymclaw-sandbox:latest';
const GATEWAY_PORT    = 8899;   // host port for inference proxy
const SANDBOX_PORT    = 18789;  // openclaw port inside sandbox
const UI_PORT         = 3847;   // web config UI

module.exports = {
  SANDBOX_NAME,
  GATEWAY_NAME,
  NETWORK_NAME,
  SANDBOX_IMAGE,
  GATEWAY_PORT,
  SANDBOX_PORT,
  UI_PORT,
};
