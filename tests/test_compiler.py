import pytest
from src.compiler.engine import SpriteCompiler
from src.compiler.models import SpriteMetadata

def test_compiler_initialization():
    compiler = SpriteCompiler()
    assert compiler.sprite_dir.exists()


def test_real_compilation():
    compiler = SpriteCompiler()
    meta = compiler.compile_sprite("boat", "A heavy wooden boat rocking slowly.")
    
    assert isinstance(meta, SpriteMetadata)
    assert meta.name == "boat"
    
    # Behavioral assertions
    assert 0.1 <= meta.frequency <= 1.0, f"Frequency {meta.frequency} is not 'slow'"
    assert meta.z_depth > 0
    assert len(meta.rotation_range) == 2