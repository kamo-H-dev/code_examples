<?php if(!defined('BASEPATH')) exit('No direct script access allowed'); 
class Site_model extends CI_Model {

    function __construct() {
       parent::__construct();
    }

	public function get_most_visited($limit, $tbl, $fields = false){
		$fields = $fields?$fields:$tbl.'.*';
		$sql = "
			SELECT 
				{$fields},
				COUNT(statistics.item_id) AS visites
			FROM 
				{$tbl} 
			LEFT JOIN 
				statistics ON statistics.item_id = {$tbl}.item_id AND statistics.item_type = '{$tbl}'
			WHERE 1
			GROUP BY {$tbl}.item_id ORDER BY visites DESC LIMIT 0, $limit			
		";
		$query = $this->db->query($sql);
// echo $this->db->last_query();
		return $query->result_array();
	}
	public function add_statistic_data($data){
		$ip_address = $data['ip_address'];
		$item_id    = $data['item_id'];
		$item_type  = $data['item_type'];
		$today = date('Ymd');
		$query = $this->db->query("SELECT * FROM statistics WHERE ip_address= '$ip_address' AND item_id='$item_id' AND item_type = '$item_type' AND date='$today'");
		//var_dump($query->num_rows());
		if($query->num_rows() == 0){
			$this->db->insert('statistics',$data);
		}
	}
	public function get_interviews_by_cat($category_id){
		$query = $this->db->query("SELECT * FROM interviews WHERE cat = '$category_id'");
		return $query->result_array();
	}
	public function get_multimedia_cat_videos($cat_id){
		$query = $this->db->query("SELECT * FROM `tv-programs` WHERE cat_id = '$cat_id'");
		return $query->result_array();
	}
	
	public function search($keyword){
		$language = $this->language;
		$query = "
			SELECT 
				news.news_title_$language AS title,
				news.text_news_$language AS text,
				CONCAT('images/news/', news.img_url) AS img,
				CONCAT('news/item/',news.news_id) AS url
				
			FROM 
				news
			WHERE 
				news.news_title_$language LIKE '%$keyword%' OR
				news.text_news_$language  LIKE '%$keyword%'
			UNION
            SELECT 
				spirituallibrary.title_$language AS title,
				spirituallibrary.description_$language AS text,
				spirituallibrary.logo AS img,
				CONCAT('spirituallibrary/index/item/',spirituallibrary.item_id) AS url
			FROM 
				spirituallibrary
			WHERE 
				spirituallibrary.title_$language LIKE '%$keyword%' OR
				spirituallibrary.description_$language  LIKE '%$keyword%'
						
		";
		//var_dump($query);exit;
		$query = $this->db->query($query);
		$result = $query->result_array();
		return $result;
	}
	public function get_dates_by_holiday_id($holiday_id){
		$query = $this->db->query("SELECT * FROM holiday_dates WHERE holiday_dates.hol_Id IN ($holiday_id) ");
		$result = $query->result();
		return $result; 
	}
	// by Aratash
	// public function get_dates_by_holiday_id($holiday_id){
		// $query = $this->db->query("SELECT * FROM holiday_dates WHERE holiday_dates.hol_Id = '$holiday_id'");
		// return $query->result_array();
	// }
	public function get_holiday_by_id($holiday_id){
		$current_year = date('Y');
		$query = $this->db->query("SELECT * FROM holiday_dates INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id  WHERE holiday_dates.hol_Id = '$holiday_id' AND holiday_dates.hol_year ='$current_year'");
		return $query->row_array();
	}
	/* by Artash
	// public function get_holiday_by_date($date){
		// $is_full_day = (strlen($date) == 10) ? true : false;
		// if($is_full_day){
			// $query = $this->db->query("SELECT * FROM holiday_dates INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id  WHERE holiday_dates.hol_date = '$date'");
			// if($query->num_rows() > 0){
				// return $query->result_array();
			// }else{
				// $query = "
					// (SELECT *
					// FROM holiday_dates
					// INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id
					// WHERE holiday_dates.hol_date < NOW()
					// ORDER BY holiday_dates.hol_date DESC
					// LIMIT 1)
					// UNION
					// (SELECT *
					// FROM holiday_dates
					// INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id
					// WHERE holiday_dates.hol_date > NOW()
					// ORDER BY holiday_dates.hol_date ASC
					// LIMIT 1)
				// ";
				// $query = $this->db->query($query);
				// return $query->result_array();
			// }
		// }elseif(strlen($date) == 4){
			// $query = $this->db->query("SELECT * FROM holiday_dates INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id  WHERE holiday_dates.hol_year = '$date'");
			// return $query->result_array();
		// }elseif(strlen($date) == 7 && $date[4] == '-'){
			// $query = $this->db->query("SELECT * FROM holiday_dates INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id  WHERE holiday_dates.hol_date LIKE '$date%'");
			// return $query->result_array();	
		// }
	// }
	*/
	public function get_holiday_by_date($date, $next=false, $next_prev=false, $PerPage=false, $pageNum=false){	
		$fileds = '`holidays`.`id` AS `uid`,
				   `holidays`.`item_id` AS `id`, 
				   `holidays`.`title_'. $this->ln .'` AS `title`, 
				   `holidays`.`desc_'. $this->ln .'` AS `desc`, 
				   `text_'. $this->ln .'` AS `text`, 
				   `holidays`.`img`, 
				   `holiday_dates`.`hol_year` AS `year`,
				   `holiday_dates`.`hol_date` AS `date`
				   ';

		$is_full_day = (strlen($date) == 10) ? true : false;		
		$limit ='';
		
		if($next){
			$query = $this->db->query("
							SELECT 
								$fileds
							FROM 
								holiday_dates
							INNER JOIN
								holidays ON holidays.item_id = holiday_dates.hol_Id
							WHERE holiday_dates.hol_date > '$date'
							ORDER BY holiday_dates.hol_date ASC
							LIMIT $next
						");
			$result	 = $query->result();	
			return $result; 
		}
		
		if($is_full_day){
			$query = $this->db->query("SELECT $fileds FROM holiday_dates INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id  WHERE holiday_dates.hol_date = '$date'");
			if($query->num_rows() > 0){				
				$result = $query->result();	
				return $result; 
			}
			else{	
				if($next_prev){
					$query = "
						(SELECT $fileds
							FROM holiday_dates
							INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id
							WHERE holiday_dates.hol_date < NOW()
							ORDER BY holiday_dates.hol_date DESC
							LIMIT 1)
						UNION
							(SELECT $fileds
							FROM holiday_dates
							INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id
							WHERE holiday_dates.hol_date > NOW()
							ORDER BY holiday_dates.hol_date ASC
							LIMIT 1)
					";			
					$query 	= $this->db->query($query);
					$result = $query->result();
					return $result;
				}			
			}
		}
		// year
		elseif(strlen($date) == 4){
			if($PerPage){
				$limit = "LIMIT $pageNum, $PerPage";
			}
			$query = $this->db->query("SELECT $fileds FROM holiday_dates INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id  WHERE holiday_dates.hol_year = '$date' ORDER BY holiday_dates.hol_date ASC {$limit} ");
			$result = $query->result();
			return $result;
		}
		// year month
		elseif(strlen($date) == 7 && $date[4] == '-'){
			$query = $this->db->query("SELECT $fileds FROM holiday_dates INNER JOIN holidays ON holidays.item_id = holiday_dates.hol_Id  WHERE holiday_dates.hol_date LIKE '$date%'");
			$result = $query->result();		
			return $result;
		}
	}

	public function get_news_by_id($news_id){ 
		$query = $this->db->query("SELECT * FROM news WHERE news_id = '$news_id'");
		return $query->row_array();
	}
	public function get_news_by_date($limit, $offset, $date, $get_count = false){
		if($get_count){
			$query = $this->db->query("SELECT COUNT(*) as count FROM news WHERE date LIKE '$date%'");
			$data = $query->row_array();
			return $data['count'];
		}else{
			$query = $this->db->query("SELECT * FROM news WHERE date LIKE '$date%' LIMIT $offset,  $limit");
			return $query->result_array();
		}
	}
	public function add_faq($data){
		$this->db->insert('faq',$data);
	}
	public function get_faq_categories(){
		$query = $this->db->query("SELECT * FROM menus INNER JOIN categories ON menus.category_id = categories.parent_id WHERE menu_id = 370661");
		return $query->result_array();
	}
	public function get_faqs($limit, $offset, $category_id){ 
		$query = $this->db->get_where('faq', array('cat_id' => $category_id), $limit, $offset);
// echo $this->db->last_query();
		return $query->result_array();
	}
	
	public function get_widgets($restrict_ids = array()){
	    $restrict_ids = implode(",", $restrict_ids);
		$fields = array(
						'`id` AS `uid`',
						'`widgets`.`item_id` AS `id`',
						'`widgets`.`title_'.$this->ln.'` AS `title`',
						'`widgets`.`text_'.$this->ln.'`  AS `text`',
						'`widgets`.`img_'.$this->ln.'`  AS `img`',
						'`img_bg`','`url`'
					);
					
		$this->db->select($fields);
		$this->db->from('widgets');
		$this->db->where_not_in('item_id', explode(',' , $restrict_ids ));
		$this->db->order_by('order', 'ASC');
		$this->db->where(array('widgets.block' => STATUS_PUBLISHED));
	// echo $this->db->last_query();
		$query = $this->db->get();		
		$result = $query->result();
		$query->free_result();
		return $result;
	}
		
// Spiritual Library	
	public function update_spirituallibrary_visit($id){
		$query = "UPDATE `spirituallibrary` SET `visits_count` = visits_count + 1 WHERE `spirituallibrary`.`item_id` = '{$id}'";
		$this->db->query($query);
		return $id;
	}
	public function update_spirituallibrary_download($id){
		$query = "UPDATE `spirituallibrary` SET `downloads_count` = downloads_count + 1 WHERE `spirituallibrary`.`item_id` = '{$id}'";
		$this->db->query($query);
		return $id;
	}
	public function get_default_spirituallibraries($type, $limit){
		$query = $this->db->order_by($type, 'DESC')->get('spirituallibrary', $limit, 0);
		return $query->result_array();
	}
	public function get_spirituallibrary_item($item_id){
		$query = $this->db->get_where('spirituallibrary', array('item_id' => $item_id));
		return $query->row_array();
	}
	public function get_spirituallibraries($limit, $offset, $category_id){
		$query = $this->db->get_where('spirituallibrary', array('cat_id' => $category_id), $limit, $offset);
		return $query->result_array();
	}
	public function get_most_visited_spirituallibraries($limit, $offset){
		$query = $this->db->order_by('visits_count', 'DESC')->get('spirituallibrary', $limit, $offset);
		return $query->result_array();
	}
	
	
	
	public function get_interpretations_by_cat($cat_id,$limit, $offset){
		$query = $this->db->order_by('date', 'DESC')->get_where('interpretations', array('cat_id' => $cat_id), $limit, $offset);
		return $query->result_array();
	}
	public function get_interpretation_item($item_id){
		$query = $this->db->get_where('interpretations', array('item_id' => $item_id));
		return $query->row_array();
	}
	public function get_most_downloads_spirituallibraries($limit, $offset){
		$query = $this->db->order_by('downloads_count', 'DESC')->get('spirituallibrary', $limit, $offset);
		return $query->result_array();
	}
	public function get_most_rates_spirituallibraries($limit, $offset){
		$query = $this->db->order_by('average_rate', 'DESC')->get('spirituallibrary', $limit, $offset);
		return $query->result_array();
	}
	public function get_advised_spirituallibraries($limit, $offset){
		$query = $this->db->order_by('advised_rate', 'DESC')->get('spirituallibrary', $limit, $offset);
		return $query->result_array();
	}
	public function get_spirituallibraries_by_date($date, $limit, $offset, $get_count = false){
		if($get_count){
			$query = $this->db->query("SELECT COUNT(*) as count FROM spirituallibrary WHERE date LIKE '$date%'");
			$data = $query->row_array();
			return $data['count'];
		}else{
			$query = $this->db->query("SELECT * FROM spirituallibrary WHERE date LIKE '%$date%' LIMIT $offset, $limit");
			return $query->result_array();
		}
	}
	
	public function search_spirt_lib($keyword, $get_count = false, $limit= false, $offset = false){
		if($get_count){
			$query = $this->db->query("SELECT COUNT(*) as count FROM spirituallibrary WHERE title_am LIKE '%$keyword%' OR description_am LIKE '%$keyword%'");
			$data = $query->row_array();	
			return $data['count'];
		}else{
			$query = $this->db->query("SELECT * FROM spirituallibrary WHERE title_am LIKE '%$keyword%' OR description_am LIKE '%$keyword%' LIMIT $offset, $limit");
			$data = $query->result_array();	
			return $data;
		}
	}
	public function search_faq($keyword, $get_count = false, $limit= false, $offset = false){
		if($get_count){
			$query = $this->db->query("SELECT COUNT(*) as count FROM faq WHERE 	question_am LIKE '%$keyword%' OR answer_am LIKE '%$keyword%'");
			$data = $query->row_array();	
			return $data['count'];
		}else{
			$query = $this->db->query("SELECT * FROM faq WHERE 	question_am LIKE '%$keyword%' OR answer_am LIKE '%$keyword%' LIMIT $offset, $limit");
			$data = $query->result_array();	
			return $data;
		}
	}
	
	
	public function add_rate($data){
		$q  = $this->db->get_where('rates', array('item_id' => $data['item_id'],  'ip' => $data['ip'], 'tbl' => $data['tbl'] ));
	    if ($q->num_rows() > 0 ) {
			
	    }else{
		    $this->db->insert('rates', $data);
			$rate = $this->get_avrage_rate($data);
			$avrage_rate = round ($rate->rate_number, 2);
			$this->update($data['tbl'], array('average_rate' => $avrage_rate), $data['item_id']);
		}
	}
		
	public function get_avrage_rate($params){
		$this->db->select_avg('rate_number');
		$query  = $this->db->get_where('rates', array('item_id' => $params['item_id'], 'tbl' => $params['tbl'] ));
		$result = $query->row();		
		$query->free_result();		
		return $result;
	}
		
		
	
	
	/*
	by Artash 
		public function get_avrage_rate($params){
		pre($params);
		$this->db->select_avg('rate_number');
		// $this->db->where('item_id' => $params['item_id']);
		$query = $this->db->get('rates');
		$result = $query->row();		
		pre($result);
		// $query = $this->db->query("SELECT * FROM rates WHERE item_id = '{$params['item_id']}'");
		// $data = $query->result_array();	
		// pre($data);
		// $count_1 = 0;
		// $count_2 = 0;
		// $count_3 = 0;
		// $count_4 = 0;
		// $count_5 = 0;
		// foreach($data as $k => $v){
			// if($v['rate_number'] == 1){
				// $count_1++;
			// }elseif($v['rate_number'] == 2){
				// $count_2++;
			// }elseif($v['rate_number'] == 3){
				// $count_3++;
			// }elseif($v['rate_number'] == 4){
				// $count_4++;
			// }elseif($v['rate_number'] == 5){
				// $count_5++;
			// }
		// }
		
		// $rate = round ( ($count_1*1 + $count_2*2 + $count_3*3 + $count_4*4 + $count_5*5)/($count_1 + $count_2 + $count_3 + $count_4 + $count_5), 2);
		
		// pre($rate);
		$query->free_result();		
		return 1;
	}
	
	*/
	
	public function add_faq_rate($data){
	    $this->db->where('item_id',$data['item_id']);
		$this->db->where('ip',$data['ip']);
		$q = $this->db->get('rates');
    	if ( $q->num_rows() > 0 ) {
			
	    }else{
		    $this->db->insert('rates',$data);
			$avrage_rate = $this->get_avrage_rate($data['item_id']);
			$this->db->where('faq_id', $data['item_id']);
			$this->db->update('faq', array('average_rate' => $avrage_rate));
		}
	}
	
	public function get_categories(){
		$query = $this->db->query("SELECT * FROM categories Where block = 1");
		$data = $query->result_array();	
		return $data;
	}
	
	private function sort_multidimension_array(&$categories_tree){
		if(!function_exists('cmp_by_optionNumber')){
			function cmp_by_optionNumber($a, $b) {
				return $a["order"] - $b["order"];
			}
		}
		usort($categories_tree, "cmp_by_optionNumber");
		foreach($categories_tree as &$v){
			if(isset($v['children'])){
				$this->sort_multidimension_array($v['children']);
			}
		}
		return $categories_tree;
	}
	
	public function get_menu_by_id($menu_id, $attributes = array(), $is_admin = false){
		$query = "
			SELECT 
				*
			FROM 
				menus 
			WHERE	
				menu_id = '$menu_id' and
				block   = 1
			
		";
		$query = $this->db->query($query);
		$data = $query->row_array();
		if(isset($data) && !empty($data)) {
			$category_id =  $data['category_id'];
			$menu_name   =  $data['name'];
			$categories = $this->get_categories();
			$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);
			$categories_tree = $this->sort_multidimension_array($categories_tree);
			$menu_html = get_menu_html($categories_tree, $attributes, $is_admin);
			return array('menu_html' => $menu_html, 'menu_name' => $menu_name); // 
		}
		return false;
	}
	
	function GetMenuCategory($menu_id, $controller, $where = false){
		$query = "
			SELECT 
				*
			FROM 
				menus 
			WHERE	
				menu_id = '{$menu_id}' AND menus.block = 1
		";
		$query = $this->db->query($query);
		$data = $query->row_array();
		$category_id = $data['category_id'];
		$menu_name = $data['name'];
		$categories = $this->get_categories();
		$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);
		/*if(!function_exists('cmp_by_optionNumber')){
			function cmp_by_optionNumber($a, $b) {
				return $a["order"] - $b["order"];
			}
		}
		usort($categories_tree, "cmp_by_optionNumber");*/
		$categories_tree = $this->sort_multidimension_array($categories_tree);
		$menu_html = GetMenuCategory($categories_tree, $controller);
		return array('menu_html' => $menu_html, 'menu_name' => $menu_name);
	}
	
	public function get_interview_menu($menu_id){
		$query = "
			SELECT 
				*
			FROM 
				menus 
			WHERE	
				menu_id = '{$menu_id}'			
		";
		$query = $this->db->query($query);
		$data = $query->row_array();
		$category_id = $data['category_id'];
		$menu_name = $data['name'];
		$categories = $this->get_categories();
		$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);
		/*if(!function_exists('cmp_by_optionNumber')){
			function cmp_by_optionNumber($a, $b) {
				return $a["order"] - $b["order"];
			}
		}
		usort($categories_tree, "cmp_by_optionNumber");*/
		$categories_tree = $this->sort_multidimension_array($categories_tree);
		
		$menu_html = get_interview_menu($categories_tree);
		return array('menu_html' => $menu_html, 'menu_name' => $menu_name);
	}
	
	
	public function get_spirituallibrary_menu(){
		$query = "
			SELECT 
				*
			FROM 
				`menus` 
			WHERE	
				`menu_id` = '777777' AND `block` = 1
			
		";
		$query = $this->db->query($query);
		$data = $query->row_array();
		$category_id = $data['category_id'];
		$menu_name = $data['name'];
		$categories = $this->get_categories();	
		$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);		
		$categories_tree = $this->sort_multidimension_array($categories_tree);	
		$menu_html = get_spirituallibrary_menu($categories_tree);
		$result = array('menu_html' => $menu_html, 'menu_name' => $menu_name);
		return $result;
	}
	/*
		$attributs=array(
			0 => id,
		    1 => class,
		)
	*/
	public function GetHorizontalDropDownMenu($tbl, $menu_id, $attributs=array()){
		$query = "SELECT * FROM `menus` WHERE	`menu_id` = '$menu_id' AND `block` = 1";
		$query = $this->db->query($query);
		$data = $query->row_array();
		$category_id = $data['category_id'];
		$menu_name = $data['name'];
		$categories = $this->get_categories();	
		$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);		
		$categories_tree = $this->sort_multidimension_array($categories_tree);	
		$menu_html 		 = HorizontalDropDownMenu($categories_tree, $tbl, $attributs);
		$result = array('menu_html' => $menu_html, 'menu_name' => $menu_name);
		return $result;
	}
	
	
	
	
	/*
	public function get_faq_menu(){
		$query = "
			SELECT 
				*
			FROM 
				menus 
			WHERE	
				menu_id = '370661'
			
		";
		$query = $this->db->query($query);
		$data = $query->row_array();
		$category_id = $data['category_id'];
		$menu_name = $data['name'];
		$categories = $this->get_categories();
		$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);
		
		$categories_tree = $this->sort_multidimension_array($categories_tree);
		//echo "<pre>";
		//print_r($categories_tree);exit;
		$menu_html = get_faq_menu($categories_tree);
		return array('menu_html' => $menu_html, 'menu_name' => $menu_name);
	}
	*/
	
	
	
	public function get_first_interpretations_item(){
		$query = "
			SELECT 
				*
			FROM 
				menus 
			WHERE	
				menu_id = '1768194'
			
		";
		$query = $this->db->query($query);
		$data = $query->row_array();
		$category_id = $data['category_id'];
		$menu_name = $data['name'];
		$categories = $this->get_categories();
		$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);
		/*if(!function_exists('cmp_by_optionNumber')){
			function cmp_by_optionNumber($a, $b) {
				return $a["order"] - $b["order"];
			}
		}
		usort($categories_tree, "cmp_by_optionNumber");*/
		$categories_tree = $this->sort_multidimension_array($categories_tree);
		return isset($categories_tree[0]['category_id'])?$categories_tree[0]['category_id']:false;
	}
	public function get_interpretations_menu(){
		$query = "
			SELECT 
				*
			FROM 
				menus 
			WHERE	
				menu_id = '1768194'
			
		";
		$query = $this->db->query($query);
		$data = $query->row_array();
		$category_id = $data['category_id'];
		$menu_name = $data['name'];
		$categories = $this->get_categories();
		$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);
		/*if(!function_exists('cmp_by_optionNumber')){
			function cmp_by_optionNumber($a, $b) {
				return $a["order"] - $b["order"];
			}
		}
		
		usort($categories_tree, "cmp_by_optionNumber");*/
		$categories_tree = $this->sort_multidimension_array($categories_tree);
		
		$menu_html = get_interpretations_menu($categories_tree);
		return array('menu_html' => $menu_html, 'menu_name' => $menu_name);
	}
	public function get_faq_first_category(){
		$query = "
			SELECT 
				*
			FROM 
				menus 
			WHERE	
				menu_id = '370661'
			
		";
		$query = $this->db->query($query);
		$data = $query->row_array();
		$category_id = $data['category_id'];
		$menu_name = $data['name'];
		$categories = $this->get_categories();
		$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);
		/*if ( ! function_exists('cmp_by_optionNumber')) {
			function cmp_by_optionNumber($a, $b) {
				return $a["order"] - $b["order"];
			}
		}
		usort($categories_tree, "cmp_by_optionNumber");*/
		$categories_tree = $this->sort_multidimension_array($categories_tree);
		return $categories_tree[0]['category_id']; 
	}
	
	public function get_multimedia_menu(){
		$query = "
			SELECT 
				*
			FROM 
				menus 
			WHERE	
				menu_id = '179783'
			
		";
		$query = $this->db->query($query);
		$data = $query->row_array();
		$category_id = $data['category_id'];
		$menu_name = $data['name'];
		$categories = $this->get_categories();
		$categories_tree = treealize($categories, 'category_id', 'parent_id', $category_id);
		/*function cmp_by_optionNumber($a, $b) {
		    return $a["order"] - $b["order"];
		}
		usort($categories_tree, "cmp_by_optionNumber");*/
		$categories_tree = $this->sort_multidimension_array($categories_tree);
		$menu_html = get_multimedia_menu($categories_tree);
		return array('menu_html' => $menu_html, 'menu_name' => $menu_name);
	}
	public function get_audio_category(){
		$sql = $this->db->query("SELECT * FROM  `categories` WHERE  `parent_id` =  '1571065'");
		// echo $this->db->last_query(); 
		
		$res = $sql->result();

		return $res;

	
	}
	
	function get_sheet($where=false){
		$fields = array(
						'`id` AS `uid`',
						'`item_id` AS `id`',
						'`title_'.$this->ln.'` AS `title`',
						'`year`','`file`','`date`'
				 );
		$this->db->select($fields);
		$this->db->from('sheet');
		$this->db->order_by("`sheet`.`order`", "ASC");
		$this->db->where(array('`sheet`.`block`' => STATUS_PUBLISHED ));
		if($where){	$this->db->where($where);}				
		$query = $this->db->get();
		$result = $query->result();
		$query->free_result();
			if($query->num_rows > 0){
				$items = array();				
				foreach($result as $row){
					$items[$row->year][] = $row;				
				}
				// pre($items);			
				krsort($items);				
				return  $items;
			}
		return false;
	}

	function GetAll($tbl, $limit = 0, $offset = 0, $fields, $sort_by, $where=false){
		$fields = ($fields)? $fields : '*';
		$this->db->select($fields);	
		if($sort_by){
			$this->db->order_by('id',$sort_by);
		}	
		if($where){	$this->db->where($where);}		
		$query = $this->db->get_where($tbl, array($tbl.'.block' => 1), $limit, $offset);
		$result = $query->result();
// echo $this->db->last_query(); 
		$query->free_result();
		return $result;
	}
	
	
	function GetField($tbl, $fields, $where=false){
		$fields = ($fields)? $fields : '*';
		$this->db->select($fields);	
		if($where){	$this->db->where($where);}		
		$query = $this->db->get_where($tbl, array($tbl.'.block' => 1));
		$result = $query->row();
		$query->free_result();	
 // echo $this->db->last_query(); 
		return $result;
	}
	
	function GetItemFaq($id, $fields = false, $where=false){
		$_fields = array(
							'`id` AS `uid`',
							'`item_id` AS `id`',
							'`title_'.$this->ln.'` AS `title`',
							'`desc_'.$this->ln.'`  AS `desc`',
							'`question_'.$this->ln.'` AS `question`',
							'`answer_'.$this->ln.'`  AS `answer`',
						);
		$fields = ($fields) ? array_merge($_fields, $fields) : $_fields;
		$this->db->select($fields);
		$this->db->from('faq');		
		$this->db->where(array('faq.item_id' => $id, 'faq.block' => STATUS_PUBLISHED));
		if($where){ $this->db->where($where);	}
		$query = $this->db->get();
		$result = $query->first_row();
		$query->free_result();
		return $result;
	}
	
	
	public function get_cat($tbl, $limit, $offset, $cat_id, $fields){
		$this->db->select($fields);
		$query = $this->db->get_where($tbl, array('cat' => $cat_id), $limit, $offset);	
		return $query->result();
	}
	
	public function update_visit($tbl, $id){
		$query = "UPDATE `{$tbl}` SET `visits_count` = visits_count + 1 WHERE `{$tbl}`.`item_id` = '{$id}' ";
		$this->db->query($query);
		return $id;
	}
		
	
	function update($tbl, $data, $id){
    	$this->db->where('`'.$tbl. '`.`item_id`', $id);
		$this->db->update($tbl, $data);
    }
    
	function insert($tbl, $data){
		$this->db->insert($tbl, $data);
		$id = $this->db->insert_id();
		return $id;
	}
}
?>