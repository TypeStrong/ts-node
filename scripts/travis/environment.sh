if
  echo "${LOCAL}" | grep -q "yes"
then
  . "${HOME}/.nvm/nvm.sh"
  TEST_DIR="/tests/${NODE}-${TYPESCRIPT}"
  cd /
  cp -R /build "${TEST_DIR}"
  cd "${TEST_DIR}"
  nvm install "${NODE}"
  nvm use "${NODE}"
fi
