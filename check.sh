if [ "$(docker ps -aq -f status=exited -f name=ies-group)" ]; then
		docker rm ies-group
		docker run -p 8016:8016 --name ies-group restart=always --net=mongo-network ies-group &
		sleep 10s
	fi