<?php

namespace CB;

/**
 * Script for applying vanilla data model to an existing core.
 * Data model described in https://dev.casebox.org/dev/view/5916/
 *
 * Its
 * Script params:
 *     -c, --core  - required, core name
 *     -s, --sql <sql_dump_file>  - optional, sql dump file,
 *                                 if no value specified then barebone core is used
 *
 * If you dont use -s option it's considered that you want to apply the model to an existing core.
 * If you specify -s without value, then barebone sql dump will be used to create the specified core.
 *
 * Example: php -f apply_vanilla_data_model.php -- -c test_core_name
 *          php apply_vanilla_data_model.php -c test_core_name -s
 *          php apply_vanilla_data_model.php -c test_core_name -s /tmp/custom_core_sql_dump.sql
 */

$binDirectorty = dirname(__FILE__) . DIRECTORY_SEPARATOR;
$cbHome = dirname($binDirectorty) . DIRECTORY_SEPARATOR;
$bareBoneCoreSql = $cbHome . 'install/mysql/bare_bone_core.sql';

//check script options
if (empty($options)) {
    $options = getopt('c:s::', array('core:', 'sql::'));
}

$coreName = empty($options['c'])
    ? @$options['core']
    : $options['c'];

if (empty($coreName)) {
    die('no core specified or invalid options set.');
}

$importConfig = array(
    'core_name' => $coreName
);

$importSql = (isset($options['s']) || isset($options['sql']));
$sqlFile = '';

if ($importSql) {
    $sqlFile = empty($options['s'])
        ? @$options['sql']
        : $options['s'];

    //set file to bare bone core if empty
    if (empty($sqlFile)) {
        $sqlFile =  $bareBoneCoreSql;
    }
}

//apply sql dump if "s" param is present
if ($importSql) {
    require_once $cbHome . 'httpsdocs/config_platform.php';
    require_once LIB_DIR . 'install_functions.php';

    Cache::set('RUN_SETUP_INTERACTIVE_MODE', true);

    if (empty($cfg['su_db_user'])) {
        $cfg['su_db_user'] = 'root';
    }

    $cfg['su_db_user'] = Install\readParam('su_db_user', $cfg['su_db_user']);
    $cfg['su_db_pass'] = Install\readParam('su_db_pass');

    if (!Install\verifyDBConfig($cfg)) {
        die('Wrong database credentials');
    }

    Cache::set('RUN_SETUP_INTERACTIVE_MODE', false);

    //start Importing sql ...
    $importConfig = array_merge(
        $importConfig,
        array(
            'overwrite_existing_core_db' => 'y'
            ,'core_solr_overwrite' => 'n'
            ,'core_solr_reindex' => 'n'
        )
    );

    //set default root password to 'test' is applying barebone sql dump
    if ($sqlFile == $bareBoneCoreSql) {
        $importConfig['core_root_pass'] = 'test';
    }

    $importConfig['importSql'] = $sqlFile;
}

$vanilla = new Import\VanillaModel($importConfig);

$vanilla->import();

echo "Done\n";