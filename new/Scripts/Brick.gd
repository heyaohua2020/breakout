extends StaticBody2D
## 砖块 — 类型/HP/碰撞

signal destroyed(brick: Node)
signal damaged(brick: Node)

var brick_type: int = 0
var hp: int = 1
var grid_row: int = 0
var grid_col: int = 0
var is_visible: bool = true

func setup(type: int, row: int, col: int) -> void:
	brick_type = type
	grid_row = row
	grid_col = col
	hp = GameManager.brick_hp.get(type, 1)
	add_to_group("bricks")
	# 金属砖 HP 随关卡提升
	if type == 2:
		hp = 3 + floori(GameManager.level / 3)
	_update_appearance()

func _update_appearance() -> void:
	var c_str = GameManager.brick_colors.get(brick_type, "#ff6b6b")
	$ColorRect.color = Color(c_str)
	
	match brick_type:
		2: # 金属
			$HP.text = "✦" + str(hp)
			$HP.visible = true
		3: # 炸弹
			$HP.text = "💣"
			$HP.visible = true
		4: # 奖励
			$HP.text = "★"
			$HP.visible = true
		_:
			$HP.visible = false
	
	# 隐形砖
	if brick_type == 5:
		if not is_visible:
			modulate = Color(1, 1, 1, 0)
			$HP.visible = false
		else:
			modulate = Color(1, 1, 1, 1)
			_update_appearance()

func hit() -> bool:
	# 隐形砖首次击中 → 显现
	if brick_type == 5 and not is_visible:
		is_visible = true
		modulate = Color(1, 1, 1, 1)
		_update_appearance()
		emit_signal("damaged", self)
		return false
	
	hp -= 1
	if hp <= 0:
		emit_signal("destroyed", self)
		return true
	else:
		_update_appearance()
		emit_signal("damaged", self)
		return false

func get_score_value() -> int:
	return GameManager.brick_score.get(brick_type, 10)

func _process(_delta: float) -> void:
	# 炸弹砖脉冲闪烁
	if brick_type == 3 and is_visible:
		var p = sin(Time.get_ticks_msec() / 300.0) * 0.15 + 0.85
		$ColorRect.modulate = Color(p, p, p, 1)
	# 奖励砖光泽
	elif brick_type == 4:
		var s = sin(Time.get_ticks_msec() / 500.0) * 0.1 + 0.9
		$ColorRect.modulate = Color(s, s, s, 1)
	else:
		$ColorRect.modulate = Color(1, 1, 1, 1)
