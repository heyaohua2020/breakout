extends Node2D
## 游戏主逻辑 — 信号连接 + 状态管理

var POWERUP_TYPES = [
	{"id":"W","name":"加宽挡板","color":"#4fc3f7","duration":10.0,"type":"buff"},
	{"id":"M","name":"多球","color":"#e91e63","duration":0.0,"type":"buff"},
	{"id":"F","name":"穿透球","color":"#ff5722","duration":8.0,"type":"buff"},
	{"id":"S","name":"减速","color":"#66bb6a","duration":8.0,"type":"buff"},
	{"id":"H","name":"加命","color":"#ff6b6b","duration":0.0,"type":"buff"},
	{"id":"G","name":"粘球挡板","color":"#ab47bc","duration":10.0,"type":"buff"},
	{"id":"N","name":"缩小挡板","color":"#ff9800","duration":10.0,"type":"debuff"},
	{"id":"E","name":"加速","color":"#ffeb3b","duration":8.0,"type":"debuff"},
]

var active_effects: Dictionary = {}
var camera_shake: float = 0.0
var is_penetrating: bool = false

var BallScene = preload("res://Scenes/Ball.tscn")
var BrickScene = preload("res://Scenes/Brick.tscn")
var PowerupScene = preload("res://Scenes/Powerup.tscn")
const LevelData = preload("res://Resources/LevelData.gd")

@onready var paddle = $World/Paddle
@onready var balls_cont = $World/Balls
@onready var bricks_cont = $World/Bricks
@onready var powerups_cont = $World/Powerups
@onready var cam = $Camera2D
@onready var score_label = $HUD/ScoreLabel
@onready var lives_label = $HUD/LivesLabel
@onready var level_label = $HUD/LevelLabel
@onready var effects_bar = $HUD/EffectsBar
@onready var menu = $"../MenuUI"
@onready var gameover = $"../GameOverUI"

func _ready() -> void:
	GameManager.state_changed.connect(_on_state_changed)
	GameManager.score_changed.connect(func(s): score_label.text = "🏆 得分: " + str(s))
	GameManager.lives_changed.connect(func(l): lives_label.text = "❤️ 生命: " + str(l))
	GameManager.level_changed.connect(func(l): level_label.text = "🏁 关卡: " + str(l))
	show_menu()

func _on_state_changed(new_state: int) -> void:
	match new_state:
		GameManager.State.MENU:
			show_menu()
		GameManager.State.PLAYING:
			hide_all_ui()
			reset_world()
		GameManager.State.PAUSED:
			pass
		GameManager.State.GAMEOVER:
			show_gameover("💀 游戏结束")
		GameManager.State.WIN:
			show_gameover("🎉 恭喜通关！")

func show_menu() -> void:
	menu.visible = true
	gameover.visible = false

func hide_all_ui() -> void:
	menu.visible = false
	gameover.visible = false

func show_gameover(title: String) -> void:
	gameover.visible = true
	gameover.get_node("GameOverTitle").text = title
	gameover.get_node("FinalScore").text = "得分: " + str(GameManager.score)

func reset_world() -> void:
	for c in bricks_cont.get_children(): c.queue_free()
	for c in balls_cont.get_children(): c.queue_free()
	for c in powerups_cont.get_children(): c.queue_free()
	active_effects.clear()
	paddle.reset_width()
	paddle.reset_position()
	build_level()

func build_level() -> void:
	var grid = LevelData.get_grid(GameManager.level)
	if grid.is_empty(): return
	var cols = grid[0].size()
	var rows = grid.size()
	var bw = mini(68, floori((800 - 40) / cols) - 4)
	var bh = 20
	var gap = 4
	var ox = (800 - (cols * (bw + gap) - gap)) / 2
	var oy = 42

	for r in rows:
		for c in cols:
			var t = grid[r][c]
			if t == 0: continue
			var brick = BrickScene.instantiate()
			brick.position = Vector2(ox + c * (bw + gap), oy + r * (bh + gap))
			brick.set_meta("bw", bw)
			brick.set_meta("bh", bh)
			brick.set_meta("ox", ox)
			brick.set_meta("oy", oy)
			bricks_cont.add_child(brick)
			brick.setup(t, r, c)
			brick.destroyed.connect(_on_brick_destroyed.bind(brick))
			brick.damaged.connect(_on_brick_damaged.bind(brick))

	# 创建球
	var ball = BallScene.instantiate()
	ball.attached_paddle = paddle
	ball.speed = 400 + (GameManager.level - 1) * 25
	ball.default_speed = ball.speed
	balls_cont.add_child(ball)
	_connect_ball_signals(ball)

func _connect_ball_signals(ball: Node) -> void:
	ball.hit_paddle.connect(_on_ball_hit_paddle.bind(ball))
	ball.hit_brick.connect(_on_ball_hit_brick.bind(ball))
	ball.fell_off.connect(_on_ball_fell_off.bind(ball))

func _on_ball_hit_paddle(ball: Node, paddle_x: float) -> void:
	if ball.ball_state != 1: return  # not FREE
	if active_effects.has("G"):
		ball.glue_to_paddle()
		AudioManager.play_paddle()
		return
	# 计算反弹角度
	var hit_pos = (ball.position.x - paddle.position.x) / (paddle.get_node("CollisionShape2D").shape.size.x / 2)
	hit_pos = clamp(hit_pos, -1, 1)
	var angle = hit_pos * PI * 0.35
	var spd = ball.velocity.length()
	ball.velocity = Vector2(sin(angle), -cos(angle)) * spd
	AudioManager.play_paddle()

func _on_ball_hit_brick(ball: Node, brick: Node) -> void:
	if not is_instance_valid(brick) or not brick.get("alive"): return
	var destroyed = brick.hit()
	if not active_effects.has("F"):
		# 普通球反弹
		var dx = ball.position.x - brick.position.x
		var dy = ball.position.y - brick.position.y
		if abs(dx) > abs(dy) * 1.2:
			ball.velocity.x = -ball.velocity.x
		else:
			ball.velocity.y = -ball.velocity.y
	if destroyed:
		_on_brick_destroyed(brick)
	else:
		_on_brick_damaged(brick)

func _on_brick_destroyed(brick: Node) -> void:
	if not is_instance_valid(brick): return
	# 计分
	GameManager.update_combo()
	GameManager.add_score(brick.get_score_value() * GameManager.get_combo_multiplier())
	AudioManager.play_break()
	# 道具掉落
	if brick.brick_type == 4:
		spawn_powerup(brick.position)
	elif randf() < 0.18:
		spawn_powerup(brick.position)
	# 炸弹爆炸
	if brick.brick_type == 3:
		_explode_bomb(brick)
	# 清理砖块
	brick.queue_free()
	await get_tree().process_frame
	_check_level_clear()

func _on_brick_damaged(brick: Node) -> void:
	if not is_instance_valid(brick): return
	AudioManager.play_hit()

func _check_level_clear() -> void:
	for c in bricks_cont.get_children():
		if is_instance_valid(c) and c.has_method("hit"):
			return
	AudioManager.play_levelup()
	GameManager.next_level()
	if GameManager.game_state == GameManager.State.PLAYING:
		build_level()

func _explode_bomb(brick: Node) -> void:
	var bw = brick.get_meta("bw")
	var bh = brick.get_meta("bh")
	var ox = brick.get_meta("ox")
	var oy = brick.get_meta("oy")
	var col = roundi((brick.position.x - ox) / (bw + 4))
	var row = roundi((brick.position.y - oy) / (bh + 4))
	trigger_shake(10.0, 0.3)
	for dr in [-1,0,1]:
		for dc in [-1,0,1]:
			if dr==0 and dc==0: continue
			for b in bricks_cont.get_children():
				if not is_instance_valid(b): continue
				var bc = roundi((b.position.x - ox) / (bw + 4))
				var br = roundi((b.position.y - oy) / (bh + 4))
				if br==row+dr and bc==col+dc and b!=brick:
					var destroyed = b.hit()
					if destroyed:
						_on_brick_destroyed(b)

func _on_ball_fell_off(ball: Node) -> void:
	ball.queue_free()
	if balls_cont.get_child_count() == 0:
		trigger_shake(5.0, 0.2)
		AudioManager.play_lose()
		GameManager.reset_combo()
		GameManager.lose_life()
		if GameManager.game_state == GameManager.State.PLAYING:
			var new_ball = BallScene.instantiate()
			new_ball.attached_paddle = paddle
			new_ball.speed = 400 + (GameManager.level - 1) * 25
			new_ball.default_speed = new_ball.speed
			balls_cont.add_child(new_ball)
			_connect_ball_signals(new_ball)

func spawn_powerup(pos: Vector2) -> void:
	var t = POWERUP_TYPES[randi() % POWERUP_TYPES.size()]
	var p = PowerupScene.instantiate()
	p.position = pos
	powerups_cont.add_child(p)
	p.setup(t)
	p.body_entered.connect(_on_powerup_caught.bind(p))

func _on_powerup_caught(body: Node, p: Node) -> void:
	if body.is_in_group("paddle"):
		activate_effect(p.get_data())

func activate_effect(data: Dictionary) -> void:
	var id = data.id
	AudioManager.play_powerup()
	if id == "H":
		GameManager.add_life(1)
		return
	if id == "M":
		_split_balls()
		return
	if data.duration <= 0: return
	if active_effects.has(id):
		active_effects[id].end_time = Time.get_ticks_msec() / 1000.0 + data.duration
		_update_effects_bar()
		return
	active_effects[id] = {end_time = Time.get_ticks_msec() / 1000.0 + data.duration, data = data}
	_apply_effect(id, true)
	_update_effects_bar()

func _apply_effect(id: String, activate: bool) -> void:
	match id:
		"W": paddle.set_width(192 if activate else 120)
		"N": paddle.set_width(72 if activate else 120)
		"S":
			for b in balls_cont.get_children():
				b.set_speed_mult(0.5 if activate else 1.0)
		"E":
			for b in balls_cont.get_children():
				b.set_speed_mult(1.6 if activate else 1.0)
		"F": is_penetrating = activate
		"G": pass  # 在碰撞时处理

func _update_effects_bar() -> void:
	for c in effects_bar.get_children(): c.queue_free()
	var now = Time.get_ticks_msec() / 1000.0
	for key in active_effects.keys():
		var ef = active_effects[key]
		if now >= ef.end_time: continue
		var label = Label.new()
		var remain = int(ef.end_time - now)
		label.text = str(ef.data.id) + " " + str(remain) + "s"
		label.add_theme_color_override("font_color", Color(ef.data.color))
		label.add_theme_font_size_override("font_size", 12)
		effects_bar.add_child(label)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		get_viewport().set_input_as_handled()
		match GameManager.game_state:
			GameManager.State.MENU:
				GameManager.start_game()
			GameManager.State.PLAYING:
				_launch_stuck_balls()
			GameManager.State.PAUSED:
				GameManager.toggle_pause()
			GameManager.State.GAMEOVER, GameManager.State.WIN:
				GameManager.start_game()
	elif (event is InputEventMouseButton or event is InputEventScreenTouch) and event.is_pressed():
		match GameManager.game_state:
			GameManager.State.MENU:
				GameManager.start_game()
			GameManager.State.PLAYING:
				_launch_stuck_balls()
			GameManager.State.GAMEOVER, GameManager.State.WIN:
				GameManager.start_game()

func _launch_stuck_balls() -> void:
	for b in balls_cont.get_children():
		if b.is_stuck():
			b.launch()

func _process(delta: float) -> void:
	if GameManager.game_state != GameManager.State.PLAYING: return
	# 更新活跃效果
	var now = Time.get_ticks_msec() / 1000.0
	var changed = false
	for key in active_effects.keys():
		if now >= active_effects[key].end_time:
			_apply_effect(key, false)
			active_effects.erase(key)
			changed = true
	if changed: _update_effects_bar()
	# 摄像机震动
	_update_shake(delta)

func trigger_shake(intensity: float, duration: float) -> void:
	camera_shake = duration

func _update_shake(delta: float) -> void:
	if camera_shake > 0:
		camera_shake -= delta
		if cam: cam.position = Vector2(randf_range(-6,6), randf_range(-6,6))
		if camera_shake <= 0 and cam: cam.position = Vector2.ZERO

func _split_balls() -> void:
	var existing = []
	for b in balls_cont.get_children():
		if b.ball_state == 1:  # FREE
			existing.append(b)
	for b in existing:
		var dir = b.velocity.normalized()
		var spd = b.velocity.length()
		for i in [-0.5, 0.5]:
			var nb = BallScene.instantiate()
			nb.position = b.position
			nb.speed = b.speed
			nb.default_speed = b.default_speed
			var a = atan2(dir.y, dir.x) + i
			nb.velocity = Vector2(cos(a), sin(a)) * spd
			nb.ball_state = 1
			balls_cont.add_child(nb)
			_connect_ball_signals(nb)
