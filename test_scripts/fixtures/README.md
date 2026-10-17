# Narration playback fixture

`narration-sample.mp3` is a short synthetic preset-voice sample generated during this project's Tencent TTS integration verification. Its only spoken content is the non-personal test sentence “你好，今天也陪你认真走一小步。”

The isolated browser tests serve these fixed bytes through their fake local TTS endpoint. They exercise real audio decoding and playback without calling a paid service or depending on ignored local caches. No provider credentials or user recordings are included. Real provider verification remains separate in `scripts/verify-workspace-v3.mjs`.
