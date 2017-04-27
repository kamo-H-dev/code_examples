<?php if ( ! defined('BASEPATH')) exit ('No direct script access allowed');

class SpiritualLibrary extends Main_controller {
	
	var $tbl		= 'spirituallibrary';	
	var $layout 	= 'spirituallibrary';
		
	public function __construct(){  
 		parent::__construct();		
		$this->load->model('search_model');
		$this->pageData['controller'] = $ctrll = $this->uri->segment(2);
		
		$rst_widget_id = $this->config->item('restricts_widgets_ids');
		$widget_ids = array($rst_widget_id['calendar'], $rst_widget_id['bible'],  $rst_widget_id['popular']);
		$this->pageData['widgets'] = $this->site_model->get_widgets($widget_ids);
		
		$left_static_menu = $this->config->item('spirituallibrary_static_menu');
		$this->pageData['left_static_menu'] = $left_static_menu[$this->ln];			
		$spirituallibrary_menu = $this->site_model->get_spirituallibrary_menu();
		$this->pageData['spirituallibrary_menu'] = $spirituallibrary_menu['menu_html'];
	}

	public function index($uri_1 = false, $uri_2 = false, $uri_3 = false){
		
		$paginationData = array();
		$mysqlData 		= array();				
		$order 			= array('order' => 'ASC');
			
	if(isset($uri_1) && !empty($uri_1) && !is_numeric($uri_1) && ($uri_2 == false ||  is_numeric($uri_2)) && $uri_3 == false ){
	
			$categories = $this->global_model->GetWhereItem('categories', array('category_id'), array('url' => $uri_1)); 

			if(isset($categories) && !empty($categories)){
				
				$paginationData = array(
								'pageNum' => $this->uri->segment(4),
								'url'	  => $uri_1,
								'segment' => 4
							);
			
				$where	= array('cat_id' => $categories->category_id);
				
				$mysqlData = array(	
							'tbl' 		=> $this->tbl,
							'where'		=> $where,
							'order'		=> $order,
						);

				$this->_GetData('main', $paginationData, $mysqlData);	
			}else{
				show_404();
			}		
		}
		
		elseif($uri_1 != false && $uri_2 != false && !is_numeric($uri_2) && ($uri_3 == false || is_numeric($uri_3))) {
		
			$categories = $this->global_model->GetWhereItem('categories', array('category_id'), array('url' => $uri_2)); 
		
			if(isset($categories) && !empty($categories)){
		
				$paginationData = array(
								'pageNum' => $this->uri->segment(5),
								'url'	  => $uri_1 .'/'. $uri_2,
								'segment' => 5
							);
				
				$where	= array('cat_id' => $categories->category_id);
				
				$mysqlData = array(	
							'tbl' 		=> $this->tbl,
							'where'		=> $where,
							'order'		=> $order,
						);
				
				$this->_GetData('main', $paginationData, $mysqlData);
			}else{
				show_404();
			}			
			
		}
		
		elseif($uri_1 != false && !is_numeric($uri_1) && $uri_2 != false &&  !is_numeric($uri_2) && $uri_3 != false) {
			
			$categories = $this->global_model->GetWhereItem('categories', array('category_id'), array('url' => $uri_3)); 

			if(isset($categories) && !empty($categories)){
				
				$paginationData = array(
								'pageNum' => $this->uri->segment(6),
								'url'	  => $uri_1 .'/'. $uri_2 .'/'. $uri_3,
								'segment' => 6
							);
		
				$where	= array('cat_id' => $categories->category_id);
				
				$mysqlData = array(	
							'tbl' 		=> $this->tbl,
							'where'		=> $where,
							'order'		=> $order,
						);
				
				$this->_GetData('main', $paginationData, $mysqlData);
			}else{
				show_404();
			}
		
		}		
		
		elseif( $uri_1 == false || is_numeric($uri_1)) {
			$this->mPopular();
		}
}
		
	public function mPopular(){	
		
		$paginationData = array(
								'pageNum' => $this->uri->segment(4),
								'url'	  => $this->uri->segment(3),
								'segment' => 4
							);			
		
		$mysqlData = array('tbl' => $this->tbl, 'where'	=>'', 'order' => array('visits_count' => 'DESC'));
						
		$this->_GetData('main', $paginationData, $mysqlData);
	}	
	
	public function mDownload(){	
		$paginationData = array(
								'pageNum' => $this->uri->segment(4),
								'url'	  => $this->uri->segment(3),
								'segment' => 4
							);			
		
		$mysqlData = array(
							'tbl' 	=> $this->tbl,
							'where'	=>'',
							'order'	=> array('downloads_count' => 'DESC'),
						);
		$this->_GetData('main', $paginationData, $mysqlData);
	}
	
	public function weRecommend(){	
		$paginationData = array(
								'pageNum' => $this->uri->segment(4),
								'url'	  => $this->uri->segment(3),
								'segment' => 4
							);	
		
		$mysqlData = array(
							'tbl' 	=> $this->tbl,
							'where'	=>'',
							'order'	=> array('advised_rate' => 'DESC'),
						);
		
		$this->_GetData('main', $paginationData, $mysqlData);
	}
		
	public function readerAdvice(){	
		
		$paginationData = array(
								'pageNum' => $this->uri->segment(4),
								'url'	  => $this->uri->segment(3),
								'segment' => 4
							);	
		
		$mysqlData = array(
							'tbl' 	=> $this->tbl,
							'where'	=>'',
							'order'	=> array('average_rate' => 'DESC'),
						);
		
		$this->_GetData('main', $paginationData, $mysqlData);
	
	}	
	
	public function show($id, $pageNum = 0) {
		if(!$id){
			redirect("/{$this->ln}/{$this->pageData['controller']}");
		}
			
		$id 	 = abs(intval($id));
		$pageNum = abs(intval($pageNum));
		$fields	 = array('`cat_id`', '`img`', '`file_'.$this->ln.'` as `file`', '`average_rate` as `average_rate`', '`advised_rate` as `advised_rate`', '`visits_count` as visits_count', '`downloads_count` as `download`' );	
		$item = $this->global_model->GetItem($this->tbl, $id, $fields);
		if(empty($item)){
			redirect("/{$this->ln}/{$this->pageData['controller']}");
		}
		$this->site_model->update_spirituallibrary_visit($id);			
		$this->pageData['item'] = $item;
		$this->load->view("{$this->tbl}/show", $this->pageData);
	}
	
	public function search($key=null, $pageNum = 0){
		if($this->input->post('search_key')){
			$search_key = $this->input->post('search_key', true);
			$search_key = mysql_real_escape_string($search_key);
			redirect(site_url($this->ln."/spirituallibrary/search/".$search_key));
		}	
		
		$key = mysql_real_escape_string(urldecode($key));
		if(isset($key) && !empty($key)){
			$records					= $this->search_model->getSpiritualLibrarySearch($key, PerPage, $pageNum);
			

			$config['total_rows']		= $records['total'];
			$config['base_url'] 		= site_url($this->ln."/{$this->tbl}/search/{$key}");
			$config['uri_segment'] 		= 5;
			$this->_pagination($config, $records['result']);		
		}
		
		$this->pageData['keyword'] 		= $key;			
		$this->pageData['pageNum'] 		= $pageNum;			
		
		$this-> _renderPage($this->tbl .'/search'); 
	}
	
	public function download($id){
		$this->load->helper('download');
		$path = $this->input->get('_file', true);
		if(!empty($id) && !empty($path)){
			if(is_file($path)){
				$file = FCPATH . $path;
				$data = file_get_contents($file); 
				$this->site_model->update_spirituallibrary_download($id);
				force_download(basename($file), $data);	
			}
		}else{
			redirect(site_url($this->ln .'/spirituallibrary'), 'location', 301);
		}
	}
	
	
	private function _GetData($view, $pagination=array(), $dbsql=array()){
	
		$pageNum 	= isset( $pagination['pageNum']) ? abs(intval( $pagination['pageNum'])) : 0;
		$pp_url		= isset( $pagination['url'] )    ?  $pagination['url'] : '';
		$pp_segment = isset( $pagination['segment'] ) ? $pagination['segment'] : 4;
		$perPage 	= PerPage;
		$numLinks 	= NumLinks;	
		
		$dbsql['fields'] = array(
						'`'.$this->tbl.'.`id` AS `uid`',
						'`'.$this->tbl.'.item_id` AS `id`',
						'`'.$this->tbl.'.title_'.$this->ln.'` AS `title`',
						'`'.$this->tbl.'.desc_'.$this->ln.'`  AS `desc`',
						'`'.$this->tbl.'.short_'.$this->ln.'` AS `short`',
						'`'.$this->tbl.'.cat_id`', 
						'`'.$this->tbl.'.img`', 
						'`'.$this->tbl.'.file_'.$this->ln.'` AS `file`',
						'`'.$this->tbl.'.average_rate`', 
						'`'.$this->tbl.'.advised_rate`', 
						'`'.$this->tbl.'.visits_count`', 
						'`'.$this->tbl.'.downloads_count` AS `download`'
					);
					
		$items						= $this->global_model->__GetAll__( $dbsql['tbl'], $dbsql['fields'], $perPage, $pageNum, $dbsql['where'], $dbsql['order']);
		// echo $this->db->last_query();
		// exit;
		
		$config['total_rows']		= $this->global_model->GetAllCount($dbsql['tbl'], $dbsql['where']);
		
		$config['base_url'] 		= site_url($this->ln ."/" .$this->tbl ."/". $pp_url);
		$config['uri_segment'] 		= $pp_segment;	
		$config['num_links'] 		= $numLinks;
		$config['per_page'] 		= $perPage;
		$config['prev_link'] 		= '&laquo;';
		$config['prev_tag_open'] 	= '';
		$config['prev_tag_close'] 	= '';
		$config['next_link'] 		= '&raquo;';
		$config['next_tag_open'] 	= '';
		$config['next_tag_close'] 	= '';
		
		$config['cur_tag_open'] 	= '<span>';
		$config['cur_tag_close']	= '</span>';
		$config['full_tag_open'] 	= '<div class="pagination">';
		$config['full_tag_close'] 	= '</div>';
		
		$config['first_link'] 		= '';
		$config['first_tag_open'] 	= '';
		$config['first_tag_close'] 	= '';
		$config['last_link'] 		= '';
		$config['last_tag_open'] 	= '';
		$config['last_tag_close'] 	= '';
		$config['num_tag_open'] 	= '';
		$config['num_tag_close'] 	= '';
		$this->pagination->initialize($config);
		
		$this->pageData['pagination'] 	= $this->pagination->create_links();		
		$this->pageData['items'] 		= $items;		
		$this->pageData['pageNum'] 		= $pageNum;	
		$this->load->view($this->tbl .'/'. $view, $this->pageData);
	}	
}
