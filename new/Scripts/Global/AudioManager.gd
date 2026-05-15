extends Node
## 音效管理器 (Autoload) — 使用 AudioStreamGenerator 合成 8-bit 音效

var _audio_stream: AudioStreamGenerator
var _playback: AudioStreamGeneratorPlayback
var _sample_rate: int = 44100

func _ready() -> void:
	_audio_stream = AudioStreamGenerator.new()
	_audio_stream.mix_rate = _sample_rate
	_audio_stream.buffer_length = 0.1
	var player = AudioStreamPlayer2D.new()
	player.stream = _audio_stream
	add_child(player)
	player.play()
	_playback = player.get_stream_playback()

func _push_sine(freq: float, duration: float, volume: float = 0.3) -> void:
	if not _playback: return
	var frames = int(_sample_rate * duration)
	var buf = PackedVector2Array()
	buf.resize(frames)
	var step = freq * TAU / _sample_rate
	for i in frames:
		var env = 1.0 - float(i) / frames
		var s = sin(step * i) * volume * env
		buf[i] = Vector2(s, s)
	_playback.push_buffer(buf)

func _push_square(freq: float, duration: float, volume: float = 0.3) -> void:
	if not _playback: return
	var frames = int(_sample_rate * duration)
	var buf = PackedVector2Array()
	buf.resize(frames)
	var step = freq * TAU / _sample_rate
	for i in frames:
		var env = 1.0 - float(i) / frames
		var s = (sign(sin(step * i))) * volume * env
		buf[i] = Vector2(s, s)
	_playback.push_buffer(buf)

func _push_saw(freq: float, duration: float, volume: float = 0.3) -> void:
	if not _playback: return
	var frames = int(_sample_rate * duration)
	var buf = PackedVector2Array()
	buf.resize(frames)
	var step = freq / _sample_rate
	for i in frames:
		var env = 1.0 - float(i) / frames
		var s = (fmod(i * step, 1.0) * 2.0 - 1.0) * volume * env
		buf[i] = Vector2(s, s)
	_playback.push_buffer(buf)

func _push_triangle(freq: float, duration: float, volume: float = 0.3) -> void:
	if not _playback: return
	var frames = int(_sample_rate * duration)
	var buf = PackedVector2Array()
	buf.resize(frames)
	var step = freq * TAU / _sample_rate
	for i in frames:
		var env = 1.0 - float(i) / frames
		var t = fmod(step * i, TAU) / TAU
		var s = (4.0 * abs(t - 0.5) - 1.0) * volume * env
		buf[i] = Vector2(s, s)
	_playback.push_buffer(buf)

func play_paddle() -> void:
	_push_square(440, 0.1, 0.3)

func play_break() -> void:
	_push_triangle(620, 0.08, 0.25)

func play_hit() -> void:
	_push_sine(380, 0.05, 0.15)

func play_lose() -> void:
	_push_sine(400, 0.35, 0.3)

func play_levelup() -> void:
	for f in [523, 659, 784]:
		_push_square(f, 0.12, 0.25)
		await get_tree().create_timer(0.05).timeout

func play_gameover() -> void:
	_push_saw(350, 0.8, 0.3)

func play_combo() -> void:
	var p = 500 + mini(GameManager.combo_count, 10) * 50
	_push_square(p, 0.08, 0.2)

func play_powerup() -> void:
	_push_sine(600, 0.15, 0.2)
