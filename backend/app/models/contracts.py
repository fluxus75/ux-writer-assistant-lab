from pydantic import BaseModel
from typing import List, Dict, Optional

class Hints(BaseModel):
    avoid_first_person: Optional[bool] = None
    length_max: Optional[int] = None
    forbidden_terms: Optional[List[str]] = None
    replace_map: Optional[Dict[str, str]] = None

class ContextItem(BaseModel):
    id: str
    user_utterance: Optional[str] = None
    response_case_raw: Optional[str] = None
    response_case_norm: Optional[str] = None
    response_case_tags: Optional[List[str]] = None
    device: Optional[str] = None
    feature: Optional[str] = None
    feature_norm: Optional[str] = None
    style_tag: Optional[str] = None
    ko_response: str
    notes: Optional[str] = None
    hints: Optional[Hints] = None

class GlossaryItem(BaseModel):
    ko_term: str
    en_term: str
    device: str
    must_use: bool = True
    pos: Optional[str] = None
    synonyms_ko: Optional[List[str]] = None
    notes: Optional[str] = None

class StyleLine(BaseModel):
    sid: str
    device: str
    feature_norm: str
    style_tag: str
    en_line: str
    notes: Optional[str] = None
