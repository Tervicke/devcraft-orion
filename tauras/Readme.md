# setup

## requirements

### setup database

We are using mysql database

1. Create a database `auction_engine`
2. Use the schema.sql to generate the mysql database

```
mysql -u username -p auction_engine < schema.sql
```

3. push some existing data in the database

```
mysql> insert into bids (auction_id , user_id , price ) values (1 , 1 , 100);
mysql> insert into bids (auction_id , user_id , price ) values (2 , 2 , 1800);
```

4. create a .env file with the following data

```
replace the username , password and port according to your system , remove the paranthesis
DB_DSN={username}:{password}@tcp(127.0.0.1:{port})/auction_engine?parseTime=true
```
