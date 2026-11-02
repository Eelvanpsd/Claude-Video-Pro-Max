"""What each TTS engine can do with expressive direction (#3422).

Clients read :func:`expression_caps` through ``list_backends()`` to show
emotion and reaction controls only where the active engine honours them, and
to explain why they are unavailable elsewhere. Stdlib-only so sidecar engine
modules can import the tag sets without pulling in the registry.
"""
from __future__ import annotations

from typing import Literal

#: OmniVoice's natively tokenized reaction tags, in the order of
#: ``omnivoice.models.omnivoice._NONVERBAL_PATTERN`` (a test keeps them equal).
OMNIVOICE_INLINE_TAGS: tuple[str, ...] = (
    "[laughter]",
    "[sigh]",
    "[confirmation-en]",
    "[question-en]",
    "[question-ah]",
    "[question-oh]",
    "[question-ei]",
    "[question-yi]",
    "[surprise-ah]",
    "[surprise-oh]",
    "[surprise-wa]",
    "[surprise-yo]",
    "[dissatisfaction-hnn]",
)

#: CosyVoice's inline paralinguistic tags (its frontend's special tokens).
COSYVOICE_INLINE_TAGS: tuple[str, ...] = ("[breath]", "[laughter]")

EmotionControl = Literal["graded", "direction", "none"]


def emotion_control(cls) -> EmotionControl:
    """How an engine takes emotion: IndexTTS2's graded controls, a written
    delivery direction through ``instruct``, or not at all."""
    if getattr(cls, "supports_emotion", False):
        return "graded"
    if getattr(cls, "instruct_directs_delivery", False):
        return "direction"
    return "none"


def expression_caps(cls) -> dict:
    """Catalogue entry: ``{"emotion": EmotionControl, "tags": [str, ...]}``."""
    tags = getattr(cls, "inline_tags", ())
    return {
        "emotion": emotion_control(cls),
        "tags": [tag for tag in tags if isinstance(tag, str)] if isinstance(tags, tuple) else [],
    }
