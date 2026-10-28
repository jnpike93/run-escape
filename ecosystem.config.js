module.exports = {
  apps: [
    {
      name: 'run-escape',
      script: 'serve.py',
      interpreter: 'python3',
      args: '8085',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 8085
      }
    }
  ]
};

