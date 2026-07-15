#!/usr/bin/env node
'use strict';

if (process.env.REALTIME_SMOKE_LIVE !== 'true') {
  console.log(
    'Realtime smoke skipped. Set REALTIME_SMOKE_LIVE=true to run a live OpenAI Realtime WebRTC check.',
  );
  process.exit(0);
}

if (process.env.SMOKE_INSECURE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

let wrtc;
try {
  wrtc = require('wrtc');
} catch (error) {
  console.error('The realtime smoke requires the API workspace wrtc dependency.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const baseUrl = (process.env.SMOKE_BASE_URL || 'https://localhost:5137').replace(/\/+$/, '');
const timeoutMs = Number(process.env.REALTIME_SMOKE_TIMEOUT_MS || 15000);

async function main() {
  const startedAt = Date.now();
  const bootstrap = await requestJson('/webrtc/session', {
    method: 'POST',
    body: JSON.stringify({ lessonType: 'tutor' }),
  });
  const sessionId = String(bootstrap.sessionId || '');
  if (!sessionId) {
    throw new Error('Realtime smoke did not receive a session id.');
  }

  const pc = new wrtc.RTCPeerConnection({
    iceServers: Array.isArray(bootstrap.iceServers) ? bootstrap.iceServers : [],
  });

  let closeStatus = 'not_closed';
  try {
    pc.addTransceiver('audio', { direction: 'recvonly' });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc, 3000);

    const description = pc.localDescription;
    if (!description || !description.sdp) {
      throw new Error('Realtime smoke failed to create a local SDP offer.');
    }

    const answerStartedAt = Date.now();
    const answer = await requestJson(`/webrtc/session/${encodeURIComponent(sessionId)}/offer`, {
      method: 'POST',
      body: JSON.stringify({ sdp: description.sdp }),
    });
    const answerLatencyMs = Date.now() - answerStartedAt;

    if (!answer.sdp) {
      throw new Error('Realtime smoke did not receive an SDP answer.');
    }
    await pc.setRemoteDescription({ type: 'answer', sdp: String(answer.sdp) });
    await waitForConnectionState(pc, ['connected', 'completed'], 8000);

    const closed = await requestJson(`/webrtc/session/${encodeURIComponent(sessionId)}/close`, {
      method: 'POST',
    });
    closeStatus = String(closed.status || 'closed');

    console.log(
      JSON.stringify(
        {
          ok: true,
          sessionId,
          conversationId: bootstrap.conversationId,
          model: bootstrap.openaiRealtimeModel,
          answerLatencyMs,
          closeStatus,
          durationMs: Date.now() - startedAt,
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      pc.close();
    } catch {
      // Nothing useful to do during smoke cleanup.
    }
    if (closeStatus === 'not_closed') {
      await requestJson(`/webrtc/session/${encodeURIComponent(sessionId)}/close`, {
        method: 'POST',
      }).catch(() => undefined);
    }
  }
}

async function requestJson(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${path}: ${text}`);
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
}

function waitForIceGatheringComplete(peerConnection, maxWaitMs) {
  if (peerConnection.iceGatheringState === 'complete') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(done, maxWaitMs);
    function done() {
      clearTimeout(timeout);
      peerConnection.removeEventListener?.('icegatheringstatechange', onChange);
      resolve();
    }
    function onChange() {
      if (peerConnection.iceGatheringState === 'complete') {
        done();
      }
    }
    peerConnection.addEventListener?.('icegatheringstatechange', onChange);
    peerConnection.onicegatheringstatechange = onChange;
  });
}

function waitForConnectionState(peerConnection, acceptedStates, maxWaitMs) {
  if (acceptedStates.includes(peerConnection.connectionState)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out waiting for WebRTC connection; last state=${peerConnection.connectionState}`,
        ),
      );
    }, maxWaitMs);
    function cleanup() {
      clearTimeout(timeout);
      peerConnection.removeEventListener?.('connectionstatechange', onChange);
    }
    function onChange() {
      if (acceptedStates.includes(peerConnection.connectionState)) {
        cleanup();
        resolve();
        return;
      }
      if (['failed', 'closed'].includes(peerConnection.connectionState)) {
        cleanup();
        reject(new Error(`WebRTC connection entered ${peerConnection.connectionState}`));
      }
    }
    peerConnection.addEventListener?.('connectionstatechange', onChange);
    peerConnection.onconnectionstatechange = onChange;
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
