FROM python:3.13-slim

# git + ssh are only needed for the optional data-repo sync
RUN apt-get update \
    && apt-get install -y --no-install-recommends git openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml README.md LICENSE ./
COPY src ./src
RUN pip install --no-cache-dir ".[all]"

RUN useradd -m -u 1000 gaggibot
USER gaggibot
ENV GAGGIBOT_STATE_DIR=/data
VOLUME /data

ENTRYPOINT ["gaggibot"]
CMD ["run"]
