export function getLoginTemplate() {
  return `
    <div class="loginView">
      <div class="loginCard">
        <span class="tag">Tutordigital</span>
        <h1>Zona docente</h1>
        <p>Introduce el código de acceso para continuar.</p>
        <div class="formField">
          <label for="accessCode">Código</label>
          <input id="accessCode" type="password" placeholder="lyceo" autocomplete="one-time-code">
        </div>
        <div class="modalActions">
          <button class="btn primary" id="accessBtn" type="button">Entrar</button>
        </div>
        <p class="hint" id="tenantLoginName">Centro: —</p>
        <p class="hint">Código demo: <strong>lyceo</strong></p>
      </div>
    </div>
  `;
}

export function getDashboardTemplate() {
  return `
    <main class="appShell" role="main">
      <header class="appHeader">
        <div class="brand">
          <span class="tag">Tutordigital</span>
          <div>
            <h1>Zona docente</h1>
            <p id="tenantName" class="meta">Centro</p>
            <p id="teacherName" class="meta"></p>
          </div>
        </div>

        <div class="headerCenter">
          <label class="groupSelect center">
            <span>Grupo</span>
            <div class="groupCenterRow">
              <select id="groupSelect" aria-label="Seleccionar grupo"></select>
            </div>
          </label>
        </div>

        <div class="headerActions right">
          <label class="inlineSelect" id="teacherSelectWrap" style="display:none">
            <span>Profe</span>
            <select id="teacherSelect" aria-label="Profesor">
              <option value="p1">Profe A</option>
              <option value="p2">Profe B</option>
            </select>
          </label>
          <div id="headerNav"></div>
        </div>
      </header>

      <div class="appGrid">
        <section class="panel">
          <div class="panelHeader">
            <div>
              <h2>Alumnos</h2>
              <div class="panelHint">Operativo diario</div>
            </div>
            <div class="studentActions">
              <label class="inlineSelect">
                <span>Orden</span>
                <select id="studentOrder" aria-label="Orden">
                  <option value="status">Estado</option>
                  <option value="surname">Apellido</option>
                </select>
              </label>
            </div>
          </div>
          <div id="studentList" class="studentList"></div>
          <p class="emptyState" id="studentEmpty">No hay alumnos en este grupo.</p>
        </section>

        <div class="rightColumn">
          <div class="topRow">
            <section class="panel" id="teacherAdminPanel">
              <div class="panelHeader">
                <div>
                  <h2>Centro · Profesores</h2>
                  <div class="panelHint">Solo admin</div>
                </div>
                <div class="studentTabs" role="tablist">
                  <button class="tabBtn copper-chip is-active" id="teacherReqTabPending" type="button">Solicitudes</button>
                  <button class="tabBtn copper-chip" id="teacherReqTabApproved" type="button">Profesores</button>
                </div>
              </div>
              <div id="teacherRequestsList" class="studentList"></div>
              <p class="emptyState" id="teacherRequestsEmpty">Sin solicitudes.</p>
              <p class="error" id="teacherRequestsError"></p>
            </section>

            <section class="panel tasksPanel">
              <div class="panelHeader">
                <div>
                  <h2>Agenda</h2>
                  <div class="panelHint">Filtra por fecha</div>
                </div>
                <div class="taskActions">
                  <div class="tabs" role="tablist">
                    <button class="tabBtn copper-chip is-active" data-range="today" type="button">Hoy</button>
                    <button class="tabBtn copper-chip" data-range="tomorrow" type="button">Mañana</button>
                    <button class="tabBtn copper-chip" data-range="week" type="button">7 días</button>
                  </div>
                  <button class="btn copper-cta" id="addTaskBtn" type="button">+ Añadir</button>
                </div>
              </div>

              <div class="taskSections">
                <div class="taskSection">
                  <div class="panelHeader">
                    <h3>Deberes</h3>
                  </div>
                  <div class="taskList" id="taskListHomework"></div>
                  <p class="emptyState" id="emptyHomework">Sin deberes en este rango.</p>
                </div>
                <div class="taskSection">
                  <div class="panelHeader">
                    <h3>Exámenes</h3>
                  </div>
                  <div class="taskList" id="taskListExam"></div>
                  <p class="emptyState" id="emptyExam">Sin exámenes en este rango.</p>
                </div>
                <div class="taskSection">
                  <div class="panelHeader">
                    <h3>Trabajos</h3>
                  </div>
                  <div class="taskList" id="taskListWork"></div>
                  <p class="emptyState" id="emptyWork">Sin trabajos en este rango.</p>
                </div>
              </div>
            </section>

            <section class="panel">
              <div class="panelHeader">
                <div>
                  <h2>Necesita profesor</h2>
                </div>
                <div class="panelHint">Tickets abiertos</div>
              </div>
              <ul class="ticketList" id="ticketList"></ul>
              <p class="emptyState" id="ticketEmpty">Sin tickets abiertos.</p>
            </section>
          </div>

          <section class="panel notebookPanel">
            <div class="panelHeader">
              <div>
                <h2>Cuaderno</h2>
                <span class="panelHint">Resumen por periodo</span>
              </div>

              <div class="notebookControls">
                <label class="inlineSelect">
                  <span>Vista</span>
                  <select id="notebookMode" aria-label="Vista del cuaderno">
                    <option value="month">Mes</option>
                    <option value="term">Trimestre</option>
                  </select>
                </label>

                <label class="inlineSelect" id="notebookMonthWrap">
                  <span>Mes</span>
                  <select id="notebookMonth" aria-label="Mes"></select>
                </label>

                <label class="inlineSelect" id="notebookTermWrap" style="display:none">
                  <span>Trimestre</span>
                  <select id="notebookTerm" aria-label="Trimestre">
                    <option value="t1">1º</option>
                    <option value="t2">2º</option>
                    <option value="t3">3º</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="notebookWrap">
              <div class="notebookGrid" id="notebookGrid"></div>
            </div>

            <p class="emptyState" id="notebookEmpty">No hay alumnos en este grupo.</p>
          </section>
        </div>
      </div>
    </main>


    <div class="modalOverlay" id="approveStudentModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2>Aprobar alumno</h2>
          <button class="iconBtn" data-close="approveStudentModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <form class="formGrid" id="approveStudentForm">
          <label class="formField">
            <span>Alumno</span>
            <input id="approveStudentName" type="text" readonly>
          </label>
          <label class="formField">
            <span>Grupo</span>
            <select id="approveStudentGroup"></select>
          </label>
        </form>
        <div class="modalActions">
          <button class="btn primary" id="approveStudentConfirm" type="button">Confirmar aprobar</button>
          <button class="btn ghost" data-close="approveStudentModal" type="button">Cancelar</button>
        </div>
        <p class="error" id="approveStudentError"></p>
      </div>
    </div>

    <div class="modalOverlay" id="rejectStudentModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2>Rechazar solicitud</h2>
          <button class="iconBtn" data-close="rejectStudentModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <form class="formGrid" id="rejectStudentForm">
          <label class="formField">
            <span>Alumno</span>
            <input id="rejectStudentName" type="text" readonly>
          </label>
          <label class="formField">
            <span>Motivo</span>
            <select id="rejectStudentReason">
              <option value="unknown">Alumno desconocido</option>
              <option value="wrong_group">Grupo equivocado</option>
              <option value="other">Otro</option>
            </select>
          </label>
        </form>
        <div class="modalActions">
          <button class="btn primary" id="rejectStudentConfirm" type="button">Confirmar rechazo</button>
          <button class="btn ghost" data-close="rejectStudentModal" type="button">Cancelar</button>
        </div>
        <p class="error" id="rejectStudentError"></p>
      </div>
    </div>


    <div class="modalOverlay" id="groupModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2>Nuevo grupo</h2>
          <button class="iconBtn" data-close="groupModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <form id="groupForm">
          <div class="formGrid">
            <div class="formField">
              <label for="groupLevel">Etapa</label>
              <select id="groupLevel" required>
                <option value="primaria">Primaria</option>
                <option value="eso">ESO</option>
                <option value="bachiller">Bachiller</option>
              </select>
            </div>
            <div class="formField">
              <label for="groupGrade">Curso</label>
              <select id="groupGrade" required></select>
            </div>
            <div class="formField">
              <label for="groupLetter">Grupo</label>
              <select id="groupLetter" required>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
              </select>
            </div>
          </div>
          <div class="modalActions">
            <button class="btn copper-cta" type="submit">Añadir</button>
            <button class="btn ghost" data-close="groupModal" type="button">Cancelar</button>
          </div>
          <p class="error" id="groupCreateError"></p>
        </form>
      </div>
    </div>

    <div class="modalOverlay" id="taskModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2>Nueva tarea</h2>
          <button class="iconBtn" data-close="taskModal" type="button">✕</button>
        </div>
        <form class="formGrid" id="taskForm">
          <label class="formField">
            <span>Tipo</span>
            <select id="taskType">
              <option value="homework">Deberes</option>
              <option value="exam">Examen</option>
              <option value="work">Trabajo</option>
            </select>
          </label>
          <label class="formField">
            <span>Entrega</span>
            <input id="taskDate" type="date">
          </label>
          <label class="formField">
            <span>Título</span>
            <input id="taskTitle" type="text" placeholder="Lectura capítulo 2">
          </label>
          <label class="formField">
            <span>Grupo</span>
            <select id="taskGroup"></select>
          </label>
          <label class="formField" style="grid-column:1/-1">
            <span>Notas para el grupo</span>
            <textarea id="taskDesc" rows="3" placeholder="Apuntar dudas clave."></textarea>
          </label>
        </form>
        <div class="attachmentsBlock">
          <div class="attachmentsHeader">
            <div>Adjuntos</div>
            <button class="btn ghost" id="taskAddFileBtn" type="button">Añadir archivo</button>
          </div>
          <input id="taskFileInput" type="file" accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
          <ul class="attachmentList" id="taskAttachmentList"></ul>
          <p class="hint" id="taskAttachmentEmpty">Sin adjuntos.</p>
        </div>
        <div class="modalActions">
          <button class="btn primary" type="submit" form="taskForm">Guardar</button>
          <button class="btn ghost" data-close="taskModal" type="button">Cancelar</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="ticketModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2 id="ticketTitle">Ticket</h2>
          <button class="iconBtn" data-close="ticketModal" type="button">✕</button>
        </div>
        <div class="ticketDetail" id="ticketDetail"></div>
        <div class="modalActions">
          <button class="btn primary" id="ticketResolveBtn" type="button">Marcar resuelto</button>
          <button class="btn ghost" data-close="ticketModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="taskDetailModal" aria-hidden="true">
      <div class="modalCard wide">
        <div class="modalHeader">
          <h2 id="taskDetailTitle">Detalle tarea</h2>
          <button class="iconBtn" data-close="taskDetailModal" type="button">✕</button>
        </div>
        <div class="ticketDetail" id="taskDetailBody"></div>
        <div class="attachmentsBlock">
          <div class="attachmentsHeader">
            <div>Adjuntos</div>
          </div>
          <ul class="attachmentList" id="taskDetailAttachments"></ul>
          <p class="hint" id="taskDetailEmpty">Sin adjuntos.</p>
        </div>
        <div class="modalActions">
          <button class="btn ghost" data-close="taskDetailModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="notebookDetailModal" aria-hidden="true">
      <div class="modalCard wide">
        <div class="modalHeader">
          <h2 id="notebookDetailTitle">Detalle</h2>
          <button class="iconBtn" data-close="notebookDetailModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="ticketDetail" id="notebookDetailBody"></div>
        <div class="modalActions">
          <button class="btn ghost" data-close="notebookDetailModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="gradesModal" aria-hidden="true">
      <div class="modalCard wide">
        <div class="modalHeader">
          <h2 id="gradesTitle">Notas</h2>
          <button class="iconBtn" data-close="gradesModal" type="button" aria-label="Cerrar">✕</button>
        </div>

        <form id="gradeForm">
          <div class="formGrid">
            <div class="formField">
              <label for="gradeTitle">Prueba</label>
              <input id="gradeTitle" type="text" placeholder="Ej. Examen Tema 3" required>
            </div>
            <div class="formField">
              <label for="gradeDate">Fecha</label>
              <input id="gradeDate" type="date" required>
            </div>
            <div class="formField">
              <label for="gradeScore">Nota</label>
              <input id="gradeScore" type="text" placeholder="Ej. 7,5 / 10" required>
            </div>
          </div>
          <div class="modalActions">
            <button class="btn copper-cta" type="submit">Añadir nota</button>
          </div>
        </form>

        <div class="attachmentsBlock" style="margin-top:10px">
          <div class="attachmentsHeader">
            <div>Historial</div>
          </div>
          <ul class="attachmentList" id="gradeList"></ul>
          <p class="hint" id="gradeEmpty">Sin notas.</p>
        </div>

        <div class="modalActions">
          <button class="btn ghost" data-close="gradesModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>

  `;
}

export function renderLoginView(appRoot, ctx) {
  appRoot.innerHTML = getLoginTemplate();
  ctx.setElements(ctx.cacheLoginElements());
  ctx.bindLoginEvents();
  ctx.elements.accessCode?.focus();
}

export function renderDashboard(appRoot, ctx) {
  appRoot.innerHTML = getDashboardTemplate();
  ctx.setElements(ctx.cacheDashboardElements());
  if (ctx.elements.studentOrder) {
    ctx.elements.studentOrder.value = ctx.state.studentOrder || "status";
  }
  ctx.renderAll();
  ctx.bindDashboardEvents();
}
