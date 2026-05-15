extends Node
## 全局游戏管理器 (Autoload) — 游戏状态、分数、关卡、信号

enum State { MENU, PLAYING, PAUSED, GAMEOVER, WIN }

var game_state: State = State.MENU
var score: int = 0
var lives: int = 3
var level: int = 1
var high_score: int = 0
var combo_count: int = 0
var last_combo_time: int = 0
var brick_types := { NORMAL=1, METAL=2, BOMB=3, REWARD=4, INVISIBLE=5 }
var brick_colors := { 1:'#ff6b6b', 2:'#78909c', 3:'#3f51b5', 4:'#4caf50', 5:'#9e9e9e' }
var brick_hp := { 1:1, 2:3, 3:1, 4:1, 5:2 }
var brick_score := { 1:10, 2:30, 3:15, 4:10, 5:15 }
const SAVE_FILE := "user://highscore.save"

signal score_changed(new_score: int)
signal lives_changed(new_lives: int)
signal level_changed(new_level: int)
signal state_changed(new_state: State)
signal combo_updated(count: int)

func _ready() -> void:
	load_high_score()

func start_game() -> void:
	score = 0; lives = 3; level = 1; combo_count = 0; last_combo_time = 0
	game_state = State.PLAYING
	state_changed.emit(game_state)
	score_changed.emit(score); lives_changed.emit(lives); level_changed.emit(level)

func toggle_pause() -> void:
	match game_state:
		State.PLAYING:
			game_state = State.PAUSED
			get_tree().paused = true
		State.PAUSED:
			game_state = State.PLAYING
			get_tree().paused = false
		_:
			return
	state_changed.emit(game_state)

func end_game(won: bool) -> void:
	game_state = State.GAMEOVER if not won else State.WIN
	if score > high_score:
		high_score = score
		save_high_score()
	state_changed.emit(game_state)

func add_score(points: int) -> void:
	score += points
	score_changed.emit(score)

func add_life(amount: int = 1) -> void:
	lives = min(lives + amount, 9)
	lives_changed.emit(lives)

func lose_life() -> void:
	lives -= 1
	lives_changed.emit(lives)
	if lives <= 0:
		end_game(false)

func next_level() -> void:
	level += 1
	level_changed.emit(level)
	if level > 10:
		end_game(true)
	else:
		lives = min(lives + 1, 5)
		lives_changed.emit(lives)

func update_combo() -> void:
	var now = Time.get_ticks_msec()
	if now - last_combo_time < 600:
		combo_count += 1
	else:
		combo_count = 1
	last_combo_time = now
	combo_updated.emit(combo_count)

func get_combo_multiplier() -> int:
	return mini(combo_count, 10)

func reset_combo() -> void:
	combo_count = 0

func load_high_score() -> void:
	if FileAccess.file_exists(SAVE_FILE):
		var f = FileAccess.open(SAVE_FILE, FileAccess.READ)
		high_score = f.get_32()

func save_high_score() -> void:
	var f = FileAccess.open(SAVE_FILE, FileAccess.WRITE)
	f.store_32(high_score)

func get_high_score_list() -> Array:
	var list = []
	if FileAccess.file_exists(SAVE_FILE):
		var f = FileAccess.open(SAVE_FILE, FileAccess.READ)
		while f.get_position() < f.get_length():
			list.append(f.get_32())
	return list
