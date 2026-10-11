#!/usr/bin/env bash
# Build the real-voice clips (public/media/voice + src/data/voice.json) from the class videos.
#   bash tools/scripts/voice/make_voice.sh            # all units, reuse saved transcripts
#   bash tools/scripts/voice/make_voice.sh --asr      # also re-run Whisper (slow, ~15 min)
# Needs: ffmpeg, Python with `pip install numpy faster-whisper pykakasi`, Node.js.
# Works in tools/voice/ (videos are downloaded to tools/voice/vids/, ~0.6 GB).
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$(cd "$HERE/../../.." && pwd)"
cd "$SITE/tools/voice"
declare -A URL=(
  [t13]=1703587069_Gb9Y1K2rV5K8FjVp [v13]=1703587072_fGeY7JUeDDOiRGOl
  [t14]=1703587094_p5wsrRqNWJNbQe14 [v14]=1703587095_zUxq6nCLqCSxtjsv
  [t15]=1703587107_7FIwu1BS9mCWrv2S [v15]=1703587108_9zbqQwnyxzUDmDeq
  [t16]=1703587134_Iuc4NAlvCiZuqjjw [v16]=1703587137_nHDQkPxiiPXsZgzZ
  [t17]=1703587154_XlFfwNBqR5FRnkfg [v17]=1703587154_6PWyF4JtotixYBH7
)
export PYTHONIOENCODING=utf-8
mkdir -p vids
for key in "${!URL[@]}"; do
  w="vwork/$key"; mkdir -p "$w"
  [ -s "vids/$key.mp4" ] || curl -s -o "vids/$key.mp4" "https://storage.googleapis.com/nilc02-storage/activities/${URL[$key]}.mp4"
  [ -s "$w/a16.wav" ] || ffmpeg -v error -y -i "vids/$key.mp4" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$w/a16.wav"
  if [ "${1:-}" = "--asr" ] || [ ! -s "$w/asr.json" ]; then
    python "$HERE/asr.py" "$w/a16.wav" "$w/asr.json" small
    python "$HERE/asr_vad.py" "$w/a16.wav" "$w/asr_vad.json" small
  fi
done
for u in 13 14 15 16 17; do for k in t v; do
  python "$HERE/align_asr.py" $u $k asr.json align_a.json > "vwork/$k$u/align_a.log"
  python "$HERE/align_asr.py" $u $k asr_vad.json align_b.json > "vwork/$k$u/align_b.log"
  python "$HERE/combine.py" $u $k
done; done
python "$HERE/cut_clips.py" "$SITE"
echo "done — open the site and check the clips; optional: python $HERE/verify_clips.py \"$SITE\""
