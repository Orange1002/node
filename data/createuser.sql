-- 建立資料庫proj_db，使用者proj_db，密碼12345，授權proj_db所有權限
CREATE DATABASE proj_db
    DEFAULT CHARACTER SET = 'utf8mb4';
CREATE USER 'proj_db'@'localhost' IDENTIFIED BY '12345';
GRANT ALL PRIVILEGES ON proj_db.* To 'proj_db'@'localhost';
FLUSH PRIVILEGES;
SHOW GRANTS FOR 'proj_db'@'localhost';
SHOW DATABASES;
SELECT user,host FROM mysql.user;