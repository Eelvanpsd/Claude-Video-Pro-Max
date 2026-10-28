# `@hypit/whisperx`

Explicit WhisperX model-family capability for speech alignment. Importing this package selects
WhisperX; Runtime registration binds the resulting evidence Need to a concrete Endpoint. The package
contains no credentials, Python environment or queue.

The package implementation consumes public Hypit author APIs and the owning domain packages and can be
released independently from the Host. Providers that interpret this exact capability may declare a
normal compatible dependency or peer range on this package; npm/pnpm and the project lockfile own the
resolved physical version. The logical capability remains `@hypit/whisperx@1`.

The official Distribution currently obtains this package as a default npm dependency because its CLI
and default HypiHub Provider use the capability contract. Its source is not embedded in the root
tarball, and its npm version can advance independently.

The package also owns `@hypit/whisperx/cli` and therefore `hypit transcribe`. That command projects an
explicit audio or video file to canonical evidence audio through `@hypit/media-local`, invokes the
selected WhisperX alignment Endpoint, and writes an ordinary `hypit.transcript@1` file. It is an
immediate authoring operation: it creates no Author Graph, Build or Result, and its transcript stays
on the input file's local clock.

```bash
hypit transcribe reference.mp4 --language en --to notes/reference.transcript.json
```

The reusable transcript document and phrase-range operations belong to `@hypit/speech-evidence`.
WhisperX owns only how evidence is obtained through this model family; media decoding remains with
the local-media executor.

`<whisperx:Alignment>` consumes one normalized `SynchronizedMedia`, its `LocalTemporalDomain`, one
authored Script Segment and the owning Narrative. For a Segment containing Tokens it also requires an
explicit lowercase two- or three-letter language code. The provider receives canonical evidence audio
tagged with the selected local domain identity and returns provider-neutral
`AlignedTranscriptEvidence` preserving that identity and exact sample span. The ordinary dependency
`@hypit/narrative-speech-alignment` then performs the deterministic authored-Narrative mapping and
publishes one `NarrativeAlignment`:

```svml
<whisperx:Alignment id="opening" narrative={story}
  segment={story.segment.opening}
  media={opening-media.media} domain={opening-media.domain}
  language="ko"/>
```

The result is `opening.alignment`. It contains semantic timing on the media-local domain, not media,
not a Timeline and not presentation policy. `@hypit/narrative-temporal` Projection explicitly combines
one or more `NarrativeAlignment + LocalTemporalDomain + equal-length Window` relations for a chosen
Timeline and publishes ordinary absolute values.

When the Segment has no Tokens, omit `language`. Its start and end map directly to the local domain's
first and final frame, no evidence audio or WhisperX capability is requested, and the same
`NarrativeAlignment` type is published.

For Chinese speech use `zh`. WhisperX may emit character-sized evidence units; local alignment maps
them to Script's authored units while Caption continues to use Script's display wording and authored Cue boundaries.
The package validates only the language-code form; the selected Endpoint owns actual language support.

## Local deployment

`@hypit/provider-hypihub` is the normal hosted adapter. A local deployment may bind the same Need:

```json
{
  "endpoints": {
    "whisperx.local": {
      "use": "@hypit/provider-whisperx-local",
      "config": { "expectedModel": "small", "alignmentLanguages": ["ko"] }
    }
  },
  "bindings": {
    "@hypit/whisperx@1#whisperx-alignment": "whisperx.local"
  }
}
```

```bash
hypit programs prepare --runtime hypit.runtime.json --endpoint whisperx.local
hypit runtime up --runtime hypit.runtime.json --endpoint whisperx.local
hypit build video.svrun --runtime hypit.runtime.json --follow
```

The Provider README owns model cache and hardware choices. For reference analysis rather than an
authored alignment, use `hypit transcribe source.mp4 --language ko --to transcript.json` with the
selected Runtime.
