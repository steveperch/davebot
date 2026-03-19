#!/usr/bin/env python3
"""Transcribe an audio file using pplx transcription SDK (ElevenLabs Scribe v2).
Called by the Node.js server as a subprocess.

Usage: python3 transcribe.py <audio_file_path>
Prints the transcript text to stdout.
"""

import asyncio
import base64
import sys

async def main(audio_path: str) -> str:
    from pplx.python.sdks.llm_api import (
        AudioBlock, AudioSource, Client, Conversation, Identity,
        LLMAPIClient, MediaGenParams, SamplingParams, SpeechToTextParams,
    )

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    client = LLMAPIClient()
    b64 = base64.b64encode(audio_bytes).decode()
    convo = Conversation()
    convo.add_user(AudioBlock(source=AudioSource(media_type="audio/mpeg", data=b64)))

    result = await client.messages.create(
        model="elevenlabs_scribe_v2",
        convo=convo,
        identity=Identity(client=Client.ASI, use_case="webserver_transcription"),
        sampling_params=SamplingParams(max_tokens=1),
        media_gen_params=MediaGenParams(
            speech_to_text=SpeechToTextParams(
                diarize=False,
                timestamps_granularity="none",
                language_code="en",
            ),
        ),
    )

    if result.transcriptions:
        return result.transcriptions[0].text
    return ""

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 transcribe.py <audio_file_path>", file=sys.stderr)
        sys.exit(1)
    
    text = asyncio.run(main(sys.argv[1]))
    print(text)
